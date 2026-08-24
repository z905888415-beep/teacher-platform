// 教师个人工作平台 —— Tauri 桌面应用入口。
// 前端为纯静态 React 应用，数据保存在系统 WebView 的 IndexedDB 中，
// 无需额外的 Rust 命令；坚果云 WebDAV 同步由前端 fetch 直接完成。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
