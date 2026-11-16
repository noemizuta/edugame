/** Error de la API con código legible: se responde `{ ok: false, error, ...extra }`. */
export class ErrorApi extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(codigo);
    this.name = 'ErrorApi';
  }
}
