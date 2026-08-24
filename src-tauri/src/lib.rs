// 教师个人工作平台 —— Tauri 桌面应用入口。
// 前端为纯静态 React 应用，数据保存在系统 WebView 的 IndexedDB 中。
// WebDAV（坚果云）同步在此通过 Rust 原生请求完成，以绕过浏览器 CORS 限制。

use serde::Deserialize;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![webdav_test, webdav_put, webdav_get])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[derive(Deserialize)]
struct WebDavConfig {
    url: String,
    username: String,
    password: String,
}

fn full_url(cfg: &WebDavConfig, filename: &str) -> String {
    let base = if cfg.url.ends_with('/') { cfg.url.clone() } else { format!("{}/", cfg.url) };
    format!("{}{}", base, filename)
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())
}

/// 测试 WebDAV 连接
#[tauri::command]
async fn webdav_test(cfg: WebDavConfig) -> Result<bool, String> {
    let resp = client()?
        .put(full_url(&cfg, ".test.txt"))
        .basic_auth(&cfg.username, Some(&cfg.password))
        .body("ok")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    Ok(resp.status().is_success())
}

/// 上传备份文件
#[tauri::command]
async fn webdav_put(cfg: WebDavConfig, filename: String, content: String) -> Result<(), String> {
    let resp = client()?
        .put(full_url(&cfg, &filename))
        .basic_auth(&cfg.username, Some(&cfg.password))
        .body(content)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if resp.status().is_success() {
        Ok(())
    } else {
        Err(format!("上传失败：HTTP {}", resp.status()))
    }
}

/// 下载备份文件
#[tauri::command]
async fn webdav_get(cfg: WebDavConfig, filename: String) -> Result<String, String> {
    let resp = client()?
        .get(full_url(&cfg, &filename))
        .basic_auth(&cfg.username, Some(&cfg.password))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if resp.status().is_success() {
        resp.text().await.map_err(|e| e.to_string())
    } else {
        Err(format!("下载失败：HTTP {}", resp.status()))
    }
}
