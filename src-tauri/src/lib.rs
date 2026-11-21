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


// BluetoothFindFirstDevice enumerates *connected* classic Bluetooth devices.
// Class-of-device major 0x04 = Audio/Video; minor 0x01/0x02/0x06 = headset,
// hands-free, headphones. Some earbuds advertise another class and may not be detected.
#[cfg(target_os = "windows")]
#[tauri::command]
fn bluetooth_headphones_connected() -> bool {
    use std::ffi::c_void;
    #[repr(C)]
    struct BluetoothDeviceSearchParams {
        dw_size: u32,
        return_authenticated: i32,
        return_remembered: i32,
        return_unknown: i32,
        return_connected: i32,
        issue_inquiry: i32,
        timeout_multiplier: u8,
        radio: *mut c_void,
    }
    #[repr(C)]
    struct SystemTime {
        year: u16, month: u16, day_of_week: u16, day: u16,
        hour: u16, minute: u16, second: u16, milliseconds: u16,
    }
    #[repr(C)]
    struct BluetoothDeviceInfo {
        dw_size: u32,
        address: u64,
        class_of_device: u32,
        connected: i32,
        remembered: i32,
        authenticated: i32,
        last_seen: SystemTime,
        last_used: SystemTime,
        name: [u16; 248],
    }
    #[link(name = "Bthprops")]
    extern "system" {
        fn BluetoothFindFirstDevice(
            params: *const BluetoothDeviceSearchParams,
            info: *mut BluetoothDeviceInfo,
        ) -> *mut c_void;
        fn BluetoothFindNextDevice(
            handle: *mut c_void,
            info: *mut BluetoothDeviceInfo,
        ) -> i32;
        fn BluetoothFindDeviceClose(handle: *mut c_void) -> i32;
    }
    let params = BluetoothDeviceSearchParams {
        dw_size: std::mem::size_of::<BluetoothDeviceSearchParams>() as u32,
        return_authenticated: 0,
        return_remembered: 0,
        return_unknown: 0,
        return_connected: 1,
        issue_inquiry: 0,
        timeout_multiplier: 0,
        radio: std::ptr::null_mut(),
    };
    let mut info: BluetoothDeviceInfo = unsafe { std::mem::zeroed() };
    info.dw_size = std::mem::size_of::<BluetoothDeviceInfo>() as u32;
    unsafe {
        let handle = BluetoothFindFirstDevice(&params, &mut info);
        if handle.is_null() { return false; }
        let mut found = false;
        loop {
            let major = (info.class_of_device >> 8) & 0x1f;
            let minor = (info.class_of_device >> 2) & 0x3f;
            if info.connected != 0 && major == 0x04 && matches!(minor, 0x01 | 0x02 | 0x06) {
                found = true;
                break;
            }
            info.dw_size = std::mem::size_of::<BluetoothDeviceInfo>() as u32;
            if BluetoothFindNextDevice(handle, &mut info) == 0 { break; }
        }
        BluetoothFindDeviceClose(handle);
        found
    }
}
#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn bluetooth_headphones_connected() -> bool { false }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![system_idle_seconds, bluetooth_headphones_connected])
        .run(tauri::generate_context!())
        .expect("failed to run Mochi");
}
