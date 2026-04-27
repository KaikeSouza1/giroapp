
import RoutesClient from './RoutesClient'


export function generateStaticParams() {
  return [] 
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <RoutesClient params={params} />
}