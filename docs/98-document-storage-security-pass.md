# 文件与资料基础设施安全增强

## 本轮目标

文件系统需要继续向生产级靠拢：上传可以接对象存储，下载和预览必须经过工作台权限校验，敏感资料不能裸露长期对象地址或被缓存。

## 已完成

- 文件读取层新增对象存储下载网关支持：配置 `OBJECT_STORAGE_DOWNLOAD_URL` 或 `BLOB_DOWNLOAD_URL` 后，下载/预览会优先由后端网关取回文件内容或临时签名 URL。
- 对象存储下载网关支持 `OBJECT_STORAGE_TOKEN` / `BLOB_READ_WRITE_TOKEN` 鉴权，避免业务接口直接依赖永久公开文件地址。
- 未配置下载网关时仍兼容原有对象 URL、本地文件和 Postgres Base64 存储，不影响当前试运营。
- 文件预览响应新增 `Cache-Control: private, no-store`，与下载接口一样避免发票、付款凭证、异常照片等敏感资料被缓存。
- 原有基础安全扫描、外部病毒扫描、文件大小限制、预览白名单和签名下载 token 机制继续保留。

## 生产接入方式

生产部署时建议配置：

- `OBJECT_STORAGE_UPLOAD_URL`：上传网关，接 Vercel Blob、S3 或自建对象存储中间层。
- `OBJECT_STORAGE_DOWNLOAD_URL`：下载网关，返回文件二进制、`bytesBase64` 或短期签名 URL。
- `OBJECT_STORAGE_TOKEN`：上传/下载网关鉴权令牌。
- `VIRUS_SCAN_WEBHOOK_URL` 或 `CLAMAV_SCAN_URL`：外部病毒扫描服务。
- `MAX_UPLOAD_BYTES`：统一控制客户和员工上传大小。
