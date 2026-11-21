#[cfg(target_os = "windows")]
#[tauri::command]
fn system_idle_seconds() -> u64 {
    #[repr(C)]
    struct LastInputInfo { cb_size: u32, dw_time: u32 }
    #[link(name = "user32")]
    extern "system" {
        fn GetLastInputInfo(info: *mut LastInputInfo) -> i32;
    }
    #[link(name = "kernel32")]
    extern "system" {
        fn GetTickCount() -> u32;
    }
    let mut info = LastInputInfo { cb_size: std::mem::size_of::<LastInputInfo>() as u32, dw_time: 0 };
    unsafe {
        if GetLastInputInfo(&mut info) == 0 { return 0; }
        (GetTickCount().wrapping_sub(info.dw_time) / 1000) as u64
    }
}
#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn system_idle_seconds() -> u64 { 0 }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![system_idle_seconds])
        .run(tauri::generate_context!())
        .expect("failed to run Mochi");
}
