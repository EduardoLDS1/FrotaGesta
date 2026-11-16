const router = require("express").Router();
const pool = require("../config/db");
const { texto, dinheiro, data, id, inteiro, exigir, transacao, atividade } = require("../lib/utils");
const { movimentar } = require("../lib/estoque");
function cadastro(b) {
  exigir(["Preventiva", "Corretiva"].includes(b.tipo), "Selecione um tipo de manutenção.");
  exigir(["Em andamento", "Concluída"].includes(b.status), "Selecione um status válido.");
  return [id(b.veiculo_id),data(b.data),b.tipo,texto(b.servico,200),dinheiro(b.custo),
    texto(b.mecanico,120),texto(b.observacoes || "",1000,false),b.status];
}
function itensSolicitados(b) {
  if (Array.isArray(b.itens)) {
    exigir(b.itens.length <= 30, "Informe no máximo 30 peças por manutenção.");
    const itens = b.itens.map(p => ({produto_id:id(p.produto_id),quantidade:inteiro(p.quantidade,1)}));
    exigir(new Set(itens.map(p => p.produto_id)).size === itens.length,"Não repita a mesma peça.");
    return {itens,legado:false};
  }
  if (!b.produto_id) return {itens:[],legado:false};
  return {itens:[{produto_id:id(b.produto_id),quantidade:inteiro(b.quantidade_pecas,1)}],legado:true};
}
const valorPecas=`COALESCE((SELECT SUM(i.quantidade*i.valor_unitario) FROM manutencao_itens i WHERE i.manutencao_id=m.id),0)`;
router.get("/", async (req,res) => {
  const {rows}=await pool.query(`SELECT m.*,v.placa,v.modelo AS veiculo_modelo,p.nome AS produto_nome,
    ${valorPecas} AS custo_pecas,
    CASE WHEN m.custo_inclui_pecas THEN m.custo ELSE m.custo+${valorPecas} END AS custo_total,
    COALESCE((SELECT json_agg(json_build_object('produto_id',i.produto_id,'nome',pr.nome,'quantidade',i.quantidade,'valor_unitario',i.valor_unitario) ORDER BY pr.nome)
      FROM manutencao_itens i JOIN produtos pr ON pr.id=i.produto_id WHERE i.manutencao_id=m.id),'[]'::json) AS itens
    FROM manutencoes m JOIN veiculos v ON v.id=m.veiculo_id
    LEFT JOIN produtos p ON p.id=m.produto_id WHERE m.excluido=FALSE ORDER BY m.data DESC,m.id DESC`);
  res.json(rows);
});
router.post("/", async (req,res) => {
  const dados=cadastro(req.body), {itens,legado}=itensSolicitados(req.body);
  res.status(201).json(await transacao(async c => {
    const v=(await c.query('SELECT id FROM veiculos WHERE id=$1 AND excluido=FALSE',[dados[0]])).rows[0];
    exigir(v,"Veículo não encontrado.",404);
    const {rows}=await c.query(`INSERT INTO manutencoes
      (veiculo_id,data,tipo,servico,custo,mecanico,observacoes,status,produto_id,quantidade_pecas,custo_inclui_pecas)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [...dados,legado?itens[0]?.produto_id:null,legado?itens[0]?.quantidade:0,legado]);
    let soma=0;
    for (const item of itens) {
      const p=(await c.query('SELECT valor_unitario FROM produtos WHERE id=$1 AND excluido=FALSE',[item.produto_id])).rows[0];
      exigir(p,"Peça não encontrada.",404);
      await movimentar(c,req.usuario,{produto_id:item.produto_id,tipo:'Saída',quantidade:item.quantidade,
        motivo:`Peças utilizadas na manutenção #${rows[0].id}`,manutencao_id:rows[0].id});
      await c.query('INSERT INTO manutencao_itens(manutencao_id,produto_id,quantidade,valor_unitario) VALUES($1,$2,$3,$4)',
        [rows[0].id,item.produto_id,item.quantidade,p.valor_unitario]);
      soma += Number(p.valor_unitario)*item.quantidade;
    }
    await atividade(c,req.usuario,'Manutenções',`Manutenção #${rows[0].id} cadastrada.`);
    return {...rows[0],custo_pecas:soma,custo_total:Number(dados[4])+(legado?0:soma)};
  }));
});
router.put('/:id',async(req,res)=>{
  const chave=id(req.params.id),dados=cadastro(req.body);
  exigir(!Object.hasOwn(req.body,'itens') && !Object.hasOwn(req.body,'produto_id') &&
    !Object.hasOwn(req.body,'quantidade_pecas'),'As peças já retiradas não podem ser alteradas na edição.');
  res.json(await transacao(async c => {
    const anterior=(await c.query('SELECT id FROM manutencoes WHERE id=$1 AND excluido=FALSE FOR UPDATE',[chave])).rows[0];
    exigir(anterior,'Manutenção não encontrada.',404);
    const {rows}=await c.query(`UPDATE manutencoes SET veiculo_id=$1,data=$2,tipo=$3,servico=$4,
      custo=$5,mecanico=$6,observacoes=$7,status=$8 WHERE id=$9 RETURNING *`,[...dados,chave]);
    await atividade(c,req.usuario,'Manutenções',`Manutenção #${chave} atualizada.`);
    return rows[0];
  }));
});
router.delete('/:id',async(req,res)=>{
  const chave=id(req.params.id);
  await transacao(async c => {
    const m=(await c.query('SELECT * FROM manutencoes WHERE id=$1 AND excluido=FALSE FOR UPDATE',[chave])).rows[0];
    exigir(m,'Manutenção não encontrada.',404);
    const itens=(await c.query('SELECT produto_id,quantidade FROM manutencao_itens WHERE manutencao_id=$1',[chave])).rows;
    for (const p of itens) await movimentar(c,req.usuario,{produto_id:p.produto_id,tipo:'Entrada',quantidade:p.quantidade,
      motivo:`Estorno por exclusão da manutenção #${chave}`,manutencao_id:chave});
    await c.query('UPDATE manutencoes SET excluido=TRUE WHERE id=$1',[chave]);
    await atividade(c,req.usuario,'Manutenções',`Manutenção #${chave} excluída; peças devolvidas ao estoque.`);
  });
  res.status(204).end();
});
module.exports=router;
