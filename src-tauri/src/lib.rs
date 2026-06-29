use std::collections::HashSet;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use tauri::Manager;

#[derive(serde::Serialize)]
struct RunResult {
    stdout: String,
    stderr: String,
    code: Option<i32>,
}

/// Path to a Python interpreter bundled as a resource, if one was shipped.
/// Drop a standalone Python under `src-tauri/resources/python/` to enable this
/// (see PACKAGING.md); otherwise we fall back to the system interpreter.
fn bundled_python(app: &tauri::AppHandle) -> Option<String> {
    let res = app.path().resource_dir().ok()?;
    let candidate = if cfg!(windows) {
        res.join("python").join("python.exe")
    } else {
        res.join("python").join("bin").join("python3")
    };
    candidate
        .exists()
        .then(|| candidate.to_string_lossy().into_owned())
}

/// Path to the python executable inside a venv directory.
fn venv_python(venv: &Path) -> PathBuf {
    if cfg!(windows) {
        venv.join("Scripts").join("python.exe")
    } else {
        venv.join("bin").join("python3")
    }
}

/// The managed virtualenv directory, under the app data dir.
fn venv_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("venv"))
}

/// Interpreters to try, in priority order: managed venv, bundled, system.
fn interpreter_candidates(app: &tauri::AppHandle) -> Vec<String> {
    let mut candidates = Vec::new();
    if let Ok(venv) = venv_dir(app) {
        let py = venv_python(&venv);
        if py.exists() {
            candidates.push(py.to_string_lossy().into_owned());
        }
    }
    if let Some(p) = bundled_python(app) {
        candidates.push(p);
    }
    let system = if cfg!(windows) {
        ["python", "python3"]
    } else {
        ["python3", "python"]
    };
    candidates.extend(system.iter().map(|s| s.to_string()));
    candidates
}

/// First interpreter (bundled or system) that responds to `--version`.
fn base_python(app: &tauri::AppHandle) -> Option<String> {
    let mut bases = Vec::new();
    if let Some(p) = bundled_python(app) {
        bases.push(p);
    }
    let system = if cfg!(windows) {
        ["python", "python3"]
    } else {
        ["python3", "python"]
    };
    bases.extend(system.iter().map(|s| s.to_string()));
    bases
        .into_iter()
        .find(|exe| Command::new(exe).arg("--version").output().is_ok())
}

/// Run a Python program, feeding `stdin` to it, and capture the result.
/// Prefers the managed venv, then a bundled interpreter, then system Python.
#[tauri::command]
fn run_python(app: tauri::AppHandle, code: String, stdin: String) -> Result<RunResult, String> {
    let candidates = interpreter_candidates(&app);

    let mut last_err = String::from("no python interpreter found");
    for exe in &candidates {
        match Command::new(exe)
            .arg("-c")
            .arg(&code)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(mut child) => {
                if let Some(mut sin) = child.stdin.take() {
                    let _ = sin.write_all(stdin.as_bytes());
                }
                let out = child.wait_with_output().map_err(|e| e.to_string())?;
                return Ok(RunResult {
                    stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
                    stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
                    code: out.status.code(),
                });
            }
            Err(e) => last_err = format!("{exe}: {e}"),
        }
    }
    Err(format!(
        "Could not start Python ({last_err}). Install Python 3 and ensure it is on PATH, \
         or bundle one (see PACKAGING.md)."
    ))
}

/// Ensure the given pip packages are installed in the managed venv.
/// Creates the venv on first use and only installs packages not already
/// recorded in `venv/.installed.txt` (so repeat runs are fast).
#[tauri::command]
fn ensure_packages(app: tauri::AppHandle, packages: Vec<String>) -> Result<RunResult, String> {
    let ok = || RunResult {
        stdout: String::new(),
        stderr: String::new(),
        code: Some(0),
    };
    if packages.is_empty() {
        return Ok(ok());
    }

    let venv = venv_dir(&app)?;
    let py = venv_python(&venv);

    // Create the venv if needed.
    if !py.exists() {
        if let Some(parent) = venv.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let base = base_python(&app)
            .ok_or("No Python interpreter found to create the environment.")?;
        let out = Command::new(&base)
            .arg("-m")
            .arg("venv")
            .arg(&venv)
            .output()
            .map_err(|e| e.to_string())?;
        if !out.status.success() {
            return Err(format!(
                "Failed to create virtualenv: {}",
                String::from_utf8_lossy(&out.stderr)
            ));
        }
    }

    // Skip packages already installed (per the marker file).
    let marker = venv.join(".installed.txt");
    let installed: HashSet<String> = std::fs::read_to_string(&marker)
        .unwrap_or_default()
        .lines()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    let missing: Vec<String> = packages
        .iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty() && !installed.contains(s))
        .collect();
    if missing.is_empty() {
        return Ok(ok());
    }

    // pip install the missing packages.
    let out = Command::new(&py)
        .arg("-m")
        .arg("pip")
        .arg("install")
        .args(&missing)
        .output()
        .map_err(|e| e.to_string())?;

    let result = RunResult {
        stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
        code: out.status.code(),
    };

    // Record successfully installed specs.
    if out.status.success() {
        let mut all: Vec<String> = installed.into_iter().collect();
        all.extend(missing);
        all.sort();
        all.dedup();
        let _ = std::fs::write(&marker, all.join("\n"));
    }

    Ok(result)
}

/// Write text to an arbitrary path (used by export, with a path from the save dialog).
#[tauri::command]
fn write_text_file_abs(path: String, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

/// Read text from an arbitrary path (used by import, with a path from the open dialog).
#[tauri::command]
fn read_text_file_abs(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            run_python,
            ensure_packages,
            write_text_file_abs,
            read_text_file_abs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
