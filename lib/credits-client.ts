// Client-side credits utilities (can be imported in client components)

export function formatCredits(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}




