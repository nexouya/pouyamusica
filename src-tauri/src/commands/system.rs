use tauri::State;

use super::AppState;

#[tauri::command]
pub fn toggle_like(path: String, state: State<'_, AppState>) -> Vec<String> {
    {
        let mut liked = state.liked.lock();
        if let Some(i) = liked.iter().position(|p| p == &path) {
            liked.remove(i);
        } else {
            liked.push(path);
        }
    }
    state.persist();
    state.liked.lock().clone()
}

#[tauri::command]
pub fn get_liked(state: State<'_, AppState>) -> Vec<String> {
    state.liked.lock().clone()
}
