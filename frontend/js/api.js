/* 唯一的后端请求封装。
 * 视图层只写 API.get/post；非 2xx 统一读 detail/message 并弹 Toast。
 */
const API = (() => {
  async function request(method, url, body) {
    const options = { method, headers: {} };
    if (body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    let resp;
    try {
      resp = await fetch(url, options);
    } catch (e) {
      Toast.error("网络异常，请确认服务已通过 run.bat 启动");
      throw e;
    }

    const text = await resp.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!resp.ok) {
      const msg = (data && (data.detail || data.message)) || `请求失败（${resp.status}）`;
      Toast.error(msg);
      const err = new Error(msg);
      err.status = resp.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    get: (url) => request("GET", url),
    post: (url, body) => request("POST", url, body),
    put: (url, body) => request("PUT", url, body),
    del: (url) => request("DELETE", url),
  };
})();
