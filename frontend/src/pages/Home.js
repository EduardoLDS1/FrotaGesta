import { useData } from "../components/useData";
import { Notice, Table, Icon, horario, numero } from "../components/UI";
export default function Home({ go }) {
  const { data, error, loading, reload } = useData("/dashboard");
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Visão Geral</h1>
          <p>Acompanhe os principais indicadores do sistema.</p>
        </div>
        <button
          className="button secondary"
          disabled={loading}
          onClick={reload}
        >
          Atualizar
        </button>
      </div>
      <Notice error={error} />
      <div className="stats-grid">
        {[
          ["Total de Veículos", data?.veiculos, "car", "green", "veiculos"],
          [
            "Em Manutenção",
            data?.em_manutencao,
            "tools",
            "yellow",
            "manutencoes",
          ],
          ["Alertas de Estoque", data?.alertas, "stock", "red", "estoque"],
          ["Viagens em andamento", data?.viagens_abertas, "route", "green", "viagens"],
        ].map(([label, value, icon, tone, page]) => (
          <button
            className={"stat-card " + tone}
            key={label}
            onClick={() => go(page)}
          >
            <span className="stat-icon">
              <Icon name={icon} width="29" height="29" />
            </span>
            <span>
              <span className="stat-label">{label}</span>
              <strong>{loading || error ? "—" : numero(value)}</strong>
            </span>
          </button>
        ))}
      </div>
      <section className="panel">
        <h2>Últimas Atualizações do Sistema</h2>
        <Table
          headers={["Data/Hora", "Módulo", "Descrição", "Usuário"]}
          rows={data?.atividades || []}
          empty={
            loading
              ? "Carregando atualizações…"
              : "As novas operações aparecerão aqui."
          }
          render={(a) => (
            <tr key={a.id}>
              <td>{horario(a.created_at)}</td>
              <td>{a.modulo}</td>
              <td className="wrap wide">{a.descricao}</td>
              <td>{a.usuario_nome}</td>
            </tr>
          )}
        />
      </section>
      {!!data?.produtos_baixos?.length && (
        <section className="panel">
          <h2>Itens que precisam de reposição</h2>
          <Table
            headers={["Item", "Modelo", "Disponível", "Estoque mínimo", "Ação"]}
            rows={data.produtos_baixos}
            render={(p) => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td>{p.modelo}</td>
                <td>{p.quantidade}</td>
                <td>{p.estoque_minimo}</td>
                <td>
                  <button
                    className="small-button"
                    onClick={() => go("estoque")}
                  >
                    Abrir estoque
                  </button>
                </td>
              </tr>
            )}
          />
        </section>
      )}
    </>
  );
}
