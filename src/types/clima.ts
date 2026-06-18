export type ClimaResponse = {
  sucesso: true;
  local: string;
  temperatura: number | null;
  sensacao: number | null;
  condicao: string;
  umidade: number | null;
  vento: number | null;
  chanceChuva: number | null;
  chuvaPrevista: number | null;
  aviso: string | null;
  atualizadoEm: string;
};

export type ClimaErrorResponse = {
  sucesso: false;
  erro: string;
};
