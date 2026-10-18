export type DocumentStorageProvider = "postgres" | "local" | "object";
export type DocumentScanStatus = "pending" | "clean" | "blocked";

export function documentStorageProviderLabel(provider?: DocumentStorageProvider) {
  const labels: Record<DocumentStorageProvider, string> = {
    postgres: "数据库归档",
    local: "本地文件",
    object: "对象存储",
  };
  return provider ? labels[provider] ?? provider : "未记录";
}

export function documentScanStatusLabel(status?: DocumentScanStatus) {
  const labels: Record<DocumentScanStatus, string> = {
    pending: "待扫描",
    clean: "已通过",
    blocked: "已拦截",
  };
  return status ? labels[status] ?? status : "待扫描";
}
