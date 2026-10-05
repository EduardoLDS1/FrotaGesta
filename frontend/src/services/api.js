const baseURL = (process.env.REACT_APP_API_URL || '').replace(/\/$/, '');

async function requisitar(caminho, opcoes = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const resposta = await fetch(`${baseURL}${caminho}`, {
      ...opcoes,
      signal: controller.signal,
      headers: { ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}), ...opcoes.headers },
    });
    if (resposta.status === 204) return null;
    const tipo = resposta.headers.get('content-type') || '';
    if (!tipo.includes('application/json')) throw new Error('A API não respondeu corretamente. Verifique se o backend está iniciado.');
    const dados = await resposta.json();
    if (!resposta.ok) {
      const erro = new Error(dados.erro || 'Não foi possível concluir a operação.');
      erro.campos = dados.campos;
      throw erro;
    }
    return dados;
  } catch (erro) {
    if (erro.name === 'AbortError') throw new Error('A API demorou para responder. Tente novamente.');
    if (erro instanceof TypeError) throw new Error('Não foi possível conectar à API. Verifique se o backend está iniciado.');
    throw erro;
  } finally { clearTimeout(timeout); }
}
export const api = {
  listar: async () => {
    const dados = await requisitar('/veiculos');
    if (!Array.isArray(dados)) throw new Error('A API retornou um formato de lista inválido. Confira a versão do backend.');
    return dados;
  },
  salvar: (dados, id) => requisitar(id ? `/veiculos/${id}` : '/veiculos', { method: id ? 'PUT' : 'POST', body: JSON.stringify(dados) }),
  excluir: id => requisitar(`/veiculos/${id}`, { method: 'DELETE' }),
};
