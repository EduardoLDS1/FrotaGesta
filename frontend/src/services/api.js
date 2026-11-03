const baseURL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
export async function api(caminho, { method = "GET", body } = {}) {
  const controller = new AbortController();
  const limite = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(baseURL + caminho, {
      method,
      credentials: "include",
      signal: controller.signal,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 204) return null;
    if (!(r.headers.get("content-type") || "").includes("application/json"))
      throw new Error(
        "A API não respondeu corretamente. Verifique se o backend está iniciado.",
      );
    const dados = await r.json();
    if (!r.ok) {
      const e = new Error(
        dados.erro || "Não foi possível concluir a operação.",
      );
      e.status = r.status;
      if (r.status === 401 && !caminho.startsWith("/auth"))
        window.dispatchEvent(new Event("sessao-expirada"));
      throw e;
    }
    return dados;
  } catch (e) {
    if (e.name === "AbortError")
      throw new Error(
        "A requisição demorou para responder. Consulte a lista antes de tentar novamente.",
      );
    if (e instanceof TypeError)
      throw new Error("Não foi possível conectar à API. Confira o backend.");
    throw e;
  } finally {
    clearTimeout(limite);
  }
}

export async function anexarComprovante(id, arquivo) {
  if (!arquivo || arquivo.size > 5*1024*1024) throw new Error('O comprovante deve ter até 5 MB.');
  const aceitos=['application/pdf','image/jpeg','image/png','image/webp'];
  if(!aceitos.includes(arquivo.type)) throw new Error('Envie PDF, JPG, PNG ou WEBP.');
  const resposta=await fetch(baseURL+`/despesas/${id}/comprovante`,{
    method:'POST',credentials:'include',headers:{'Content-Type':arquivo.type,
      'X-Nome-Arquivo':encodeURIComponent(arquivo.name.slice(0,180))},body:arquivo
  });
  const dados=await resposta.json();
  if(!resposta.ok) throw new Error(dados.erro||'Não foi possível salvar o comprovante.');
  return dados;
}
export async function abrirComprovante(id) {
  const resposta=await fetch(baseURL+`/despesas/${id}/comprovante`,{credentials:'include'});
  if(!resposta.ok) {
    const dados=await resposta.json().catch(()=>({}));
    throw new Error(dados.erro||'Não foi possível abrir o comprovante.');
  }
  const blob=await resposta.blob();
  const url=URL.createObjectURL(blob);
  const janela=window.open(url,'_blank','noopener,noreferrer');
  if(!janela) {
    const a=document.createElement('a');a.href=url;a.download=`comprovante-${id}`;a.click();
  }
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
