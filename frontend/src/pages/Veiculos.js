import { useState, useRef } from "react";
import { api } from "../services/api";
import { useData } from "../components/useData";
import {
  Field,
  Notice,
  Table,
  Pager,
  Badge,
  Actions,
  numero,
  dia,
  Icon,
} from "../components/UI";
const inicial = {
  placa: "",
  marca: "",
  modelo: "",
  ano: "",
  quilometragem: "",
  combustivel: "Gasolina",
  consumo_medio: "",
  preco_litro: "",
  situacao_aquisicao: "Não informado",
  data_aquisicao: "",
  valor_compra: "",
  valor_entrada: "",
  valor_parcela: "",
  total_parcelas: "",
  parcelas_pagas: "",
  observacoes_financeiras: "",
  primeiro_vencimento: "",
};
export default function Veiculos() {
  const lista = useData("/veiculos"),
    [form, setForm] = useState(inicial),
    [edit, setEdit] = useState(null),
    [show, setShow] = useState(false),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const ref = useRef();
  const filtrados = (lista.data || []).filter((v) =>
    (v.placa + " " + v.marca + " " + v.modelo)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const change = (k, v) =>
    setForm((s) => ({ ...s, [k]: k === "placa" ? v.toUpperCase() : v }));
  async function salvar(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(edit ? `/veiculos/${edit}` : "/veiculos", {
        method: edit ? "PUT" : "POST",
        body: {
          ...form,
          ano: form.ano === "" ? null : Number(form.ano),
          quilometragem: Number(form.quilometragem),
          consumo_medio: form.consumo_medio === "" ? null : Number(form.consumo_medio),
          preco_litro: form.preco_litro === "" ? null : Number(form.preco_litro),
          data_aquisicao: form.data_aquisicao || null,
          valor_compra: Number(form.valor_compra || 0),
          valor_entrada: Number(form.valor_entrada || 0),
          valor_parcela: Number(form.valor_parcela || 0),
          total_parcelas: Number(form.total_parcelas || 0),
          parcelas_pagas: Number(form.parcelas_pagas || 0),
        },
      });
      setSuccess(edit ? "Veículo atualizado." : "Veículo cadastrado.");
      setShow(false);
      setEdit(null);
      setForm(inicial);
      await lista.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function excluir(v) {
    if (busy || !window.confirm(`Excluir o veículo ${v.placa}?`)) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(`/veiculos/${v.id}`, { method: "DELETE" });
      setSuccess("Veículo excluído.");
      await lista.reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Gestão de Veículos</h1>
          <p>Cadastre e acompanhe sua frota.</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setEdit(null);
            setForm(inicial);
            setShow(true);
          }}
        >
          <Icon name="plus" />
          Novo Veículo
        </button>
      </div>
      <Notice error={error || lista.error} success={success} />
      {show && (
        <section className="panel" ref={ref}>
          <h2>{edit ? "Editar Veículo" : "Cadastro de Veículo"}</h2>
          <form onSubmit={salvar}>
            <fieldset disabled={busy}>
              <div className="form-grid three">
                <Field
                  label="Placa"
                  name="placa"
                  value={form.placa}
                  onChange={change}
                  required
                  maxLength={7}
                  pattern="[A-Z]{3}[0-9][A-Z0-9][0-9]{2}"
                  title="Use ABC1234 ou ABC1D23, sem hífen."
                  placeholder="ABC1D23"
                />
                <Field
                  label="Marca"
                  name="marca"
                  value={form.marca}
                  onChange={change}
                  required
                  maxLength={100}
                />
                <Field
                  label="Modelo"
                  name="modelo"
                  value={form.modelo}
                  onChange={change}
                  required
                  maxLength={100}
                />
                <Field
                  label="Ano (opcional)"
                  name="ano"
                  value={form.ano}
                  onChange={change}
                  type="number"
                  min="1900"
                  max="2100"
                  step="1"
                />
                <Field
                  label="Quilometragem (km)"
                  name="quilometragem"
                  value={form.quilometragem}
                  onChange={change}
                  type="number"
                  min="0"
                  max="9999999999.99"
                  step="0.01"
                  required
                />
                <Field label="Combustível" name="combustivel" value={form.combustivel} onChange={change}
                  options={["Gasolina", "Etanol", "Diesel", "Flex", "GNV", "Elétrico", "Outro"].map(v => ({value:v,label:v}))} />
                <Field label="Situação de aquisição" name="situacao_aquisicao" value={form.situacao_aquisicao}
                  onChange={(k, v) => setForm(s => ({...s, [k]:v, valor_compra:"", valor_entrada:"",valor_parcela:"",total_parcelas:"",parcelas_pagas:"",primeiro_vencimento:""}))}
                  options={["Não informado", "Quitado", "Financiado", "Locado"].map(v => ({value:v,label:v}))} />
                {(["Quitado", "Financiado"].includes(form.situacao_aquisicao)) && <>
                  <Field label="Data de aquisição" name="data_aquisicao" value={form.data_aquisicao} onChange={change} type="date" required />
                  <Field label="Valor da compra (R$)" name="valor_compra" value={form.valor_compra} onChange={change} type="number" step="0.01" min="0.01" required />
                </>}
                {form.situacao_aquisicao === "Financiado" && <>
                  <Field label="Entrada já paga (R$)" name="valor_entrada" value={form.valor_entrada} onChange={change} type="number" step="0.01" min="0" required />
                  <Field label="Valor de cada parcela (R$)" name="valor_parcela" value={form.valor_parcela} onChange={change} type="number" step="0.01" min="0.01" required />
                  <Field label="Total de parcelas" name="total_parcelas" value={form.total_parcelas} onChange={change} type="number" min="1" max="600" step="1" required />
                  <Field label="Parcelas já pagas" name="parcelas_pagas" value={form.parcelas_pagas} onChange={change} type="number" min="0" max={form.total_parcelas || 600} step="1" required />
                </>}
                {(["Financiado", "Locado"].includes(form.situacao_aquisicao)) && <Field label="Primeiro vencimento da cobrança automática" name="primeiro_vencimento" value={form.primeiro_vencimento} onChange={change} type="date" required />}
                {form.situacao_aquisicao === "Locado" && <Field label="Aluguel mensal (R$)" name="valor_parcela" value={form.valor_parcela} onChange={change} type="number" min="0.01" step="0.01" required />}
                <Field label="Observações financeiras" name="observacoes_financeiras" value={form.observacoes_financeiras} onChange={change} maxLength={500} />
              </div>
              <p className="helper">A compra quitada ou entrada aparece no relatório na data de aquisição. As mensalidades futuras aparecem automaticamente como pendentes na tela Despesas; clique em Confirmar pagamento após pagar. O número de parcelas pagas será atualizado. No cadastro, informe quantas já tinham sido pagas antes de usar o sistema.</p>
              <div className="form-end">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setShow(false)}
                >
                  Cancelar
                </button>
                <button className="button primary">
                  {busy
                    ? "Salvando…"
                    : edit
                      ? "Salvar alterações"
                      : "Cadastrar veículo"}
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}
      <section className="panel">
        <h2>Veículos Cadastrados</h2>
        <div className="filters">
          <input
            aria-label="Buscar veículos"
            placeholder="Buscar placa, marca ou modelo…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          <button
            className="button secondary"
            disabled={lista.loading || busy}
            onClick={lista.reload}
          >
            Atualizar
          </button>
        </div>
        <Table
          headers={[
            "ID",
            "Placa",
            "Modelo",
            "Ano",
            "Quilometragem",
            "Aquisição / Consumo",
            "Status",
            "Última Manutenção",
            "Ações",
          ]}
          rows={filtrados.slice((page - 1) * 10, page * 10)}
          empty={
            lista.loading
              ? "Carregando veículos…"
              : "Nenhum veículo encontrado."
          }
          render={(v) => (
            <tr key={v.id}>
              <td>{v.id}</td>
              <td>
                <strong>{v.placa}</strong>
              </td>
              <td>
                {v.modelo}
                <small>{v.marca}</small>
              </td>
              <td>{v.ano || "—"}</td>
              <td>{numero(v.quilometragem)} km</td>
              <td className="wrap">{v.situacao_aquisicao}<small>{v.consumo_medio ? `${v.consumo_medio} km/l` : "Média não definida"}</small></td>
              <td>
                <Badge tone={v.status === "Em manutenção" ? "yellow" : v.status === "Em viagem" ? "yellow" : "green"}>
                  {v.status}
                </Badge>
              </td>
              <td>{dia(v.ultima_manutencao)}</td>
              <td>
                <Actions
                  label={v.placa}
                  disabled={busy}
                  edit={() => {
                    setEdit(v.id);
                    setForm({
                      placa: v.placa,
                      marca: v.marca,
                      modelo: v.modelo,
                      ano: String(v.ano ?? ""),
                      quilometragem: String(v.quilometragem),
                      combustivel: v.combustivel || "Gasolina",
                      consumo_medio: "",
                      preco_litro: "",
                      situacao_aquisicao: v.situacao_aquisicao || "Não informado",
                      data_aquisicao: v.data_aquisicao ? String(v.data_aquisicao).slice(0, 10) : "",
                      valor_compra: String(v.valor_compra ?? ""),
                      valor_entrada: String(v.valor_entrada ?? ""),
                      valor_parcela: String(v.valor_parcela ?? ""),
                      total_parcelas: String(v.total_parcelas ?? ""),
                      parcelas_pagas: String(v.parcelas_pagas ?? ""),
                      observacoes_financeiras: v.observacoes_financeiras || "",
                      primeiro_vencimento: v.primeiro_vencimento ? String(v.primeiro_vencimento).slice(0,10) : "",
                    });
                    setShow(true);
                    setTimeout(
                      () => ref.current?.scrollIntoView({ behavior: "smooth" }),
                      0,
                    );
                  }}
                  remove={() => excluir(v)}
                />
              </td>
            </tr>
          )}
        />
        <Pager total={filtrados.length} page={page} setPage={setPage} />
      </section>
    </>
  );
}
