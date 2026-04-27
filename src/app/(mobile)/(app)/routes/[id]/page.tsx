
import RouteClient from './RouteClient'

export function generateStaticParams() {
  return [] 
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <RouteClient params={params} />
}