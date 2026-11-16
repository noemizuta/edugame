import { Unirse } from './Unirse';

// P03 Unirse al aula (acepta ?codigo=XXXXXX, del QR del afiche)
export default async function PaginaUnirse({ searchParams }: { searchParams: Promise<{ codigo?: string | string[] }> }) {
  const { codigo } = await searchParams;
  const inicial = (Array.isArray(codigo) ? codigo[0] : codigo) ?? '';
  return <Unirse codigoInicial={inicial.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)} />;
}
