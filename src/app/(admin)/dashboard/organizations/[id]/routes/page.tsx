// src/app/(admin)/dashboard/organizations/[id]/routes/page.tsx
import RoutesClient from './RoutesClient'

// 👇 ISSO AQUI É O QUE O BUILD EXIGE PARA NÃO DAR ERRO
export function generateStaticParams() {
  return [] // Diz ao Next para não pré-gerar nenhum ID, o JS resolve isso no celular
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <RoutesClient params={params} />
}