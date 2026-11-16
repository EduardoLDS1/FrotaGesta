const baseURL = (process.env.REACT_APP_API_URL || '').replace(/\/$/, '');
export async function api(caminho, { method='GET', body }={}) {
  const controller = new AbortController();
  const limite = setTimeout(() => controller.abort(), 15000);
  try {
    const resposta = await fetch(baseURL+caminho, {
      method,credentials:'include',signal:controller.signal,
      headers:body?{'Content-Type':'application/json'}:undefined,
      body:body?JSON.stringify(body):undefined
    });
    if(resposta.status===204) return null;
    if(!(resposta.headers.get('content-type')||'').includes('application/json'))
      throw new Error('A API não respondeu corretamente. Confira o servidor.');
    const dados=await resposta.json();
    if(!resposta.ok){
      const erro=new Error(dados.erro||'Não foi possível concluir a operação.');
      erro.status=resposta.status;
      if(resposta.status===401&&!caminho.startsWith('/auth')) window.dispatchEvent(new Event('sessao-expirada'));
      throw erro;
    }
    return dados;
  }catch(e){
    if(e.name==='AbortError') throw new Error('A requisição demorou a responder. Confira a lista antes de repetir.');
    if(e instanceof TypeError) throw new Error('Falha na conexão. Confira se o servidor está ligado.');
    throw e;
  }finally{clearTimeout(limite);}
}
export async function enviarComArquivo(caminho, dados, arquivo, method='POST') {
  const aceitos=['application/pdf','image/jpeg','image/png','image/webp'];
  if(arquivo && (arquivo.size>5*1024*1024||!aceitos.includes(arquivo.type)))
    throw new Error('O comprovante deve ser PDF, JPG, PNG ou WEBP, com até 5 MB.');
  const resposta=await fetch(baseURL+caminho,{
    method,credentials:'include',
    headers:{'Content-Type':'application/octet-stream',
      'X-Dados':encodeURIComponent(JSON.stringify(dados)),
      'X-Nome-Arquivo':encodeURIComponent((arquivo?.name||'sem-comprovante').slice(0,180))},
    body:arquivo||new Blob([],{type:'application/octet-stream'})
  });
  const resultado=await resposta.json().catch(()=>({}));
  if(!resposta.ok) {
    if(resposta.status===401) window.dispatchEvent(new Event('sessao-expirada'));
    throw new Error(resultado.erro||'Não foi possível registrar o pagamento.');
  }
  return resultado;
}
export async function anexarComprovante(id,arquivo){
  return enviarComArquivo(`/despesas/${id}/comprovante`,{},arquivo);
}
export async function abrirComprovante(id){
  const resposta=await fetch(baseURL+`/despesas/${id}/comprovante`,{credentials:'include'});
  if(!resposta.ok){const dados=await resposta.json().catch(()=>({}));throw new Error(dados.erro||'Acesso ao comprovante negado.');}
  const blob=await resposta.blob();
  const url=URL.createObjectURL(blob);
  const janela=window.open(url,'_blank','noopener,noreferrer');
  if(!janela){const a=document.createElement('a');a.href=url;a.download=`comprovante-${id}`;a.click();}
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export function urlEventos(){return baseURL+'/despesas/eventos';}
