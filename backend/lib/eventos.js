const clientes = new Set();
function conectar(req, res) {
  res.setHeader('Content-Type','text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control','no-cache, no-transform');
  res.setHeader('Connection','keep-alive');
  res.flushHeaders();
  res.write('event: conectado\ndata: {}\n\n');
  clientes.add(res);
  const pulso = setInterval(() => res.write(': ativo\n\n'), 25000);
  req.on('close', () => { clearInterval(pulso); clientes.delete(res); });
}
function avisar() {
  for (const cliente of clientes) cliente.write('event: atualizado\ndata: {}\n\n');
}
module.exports = { conectar, avisar };
