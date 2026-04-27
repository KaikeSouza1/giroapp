
import CheckinClient from './CheckinClient'




export function generateStaticParams() {
  return []
}

export default function CheckinPage({ params }: { params: Promise<{ id: string }> }) {
  return <CheckinClient params={params} />
}