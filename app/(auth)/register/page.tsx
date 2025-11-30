'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowRight, Sparkles, Check } from 'lucide-react'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500 mb-6">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Email envoyé !</h1>
          <p className="text-muted-foreground mt-3 mb-8">
            Vérifie ta boîte mail pour confirmer ton compte et commencer à créer.
          </p>
          <Link href="/login">
            <Button variant="outline" className="rounded-xl h-11 px-6">
              Retour à la connexion
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-foreground text-background p-12 flex-col justify-between relative overflow-hidden">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-foreground via-foreground to-neutral-800" />
        
        {/* Decorative elements */}
        <div className="absolute top-20 right-20 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
              <span className="text-foreground font-bold">U</span>
            </div>
            <span className="font-semibold text-xl">UGC AI</span>
          </div>
        </div>
        
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-sm backdrop-blur-sm">
            <Sparkles className="w-4 h-4" />
            <span>Propulsé par l'IA</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold leading-tight tracking-tight">
            Rejoins la révolution<br />
            <span className="text-white/60">de la pub UGC</span>
          </h1>
          <p className="text-white/60 text-lg max-w-md">
            Des milliers de créateurs utilisent déjà UGC AI pour générer 
            des publicités authentiques et performantes.
          </p>
          
          {/* Features */}
          <div className="space-y-3 pt-4">
            {['Génération en quelques minutes', 'Acteurs virtuels réalistes', 'Export multi-plateformes'].map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-white/80">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </div>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="relative z-10 flex items-center gap-6 text-sm text-white/40">
          <span>© 2024 UGC AI</span>
          <span>•</span>
          <span>Tous droits réservés</span>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-foreground mb-4">
              <span className="text-background font-bold text-xl">U</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">UGC AI</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight">Créer un compte</h2>
            <p className="text-muted-foreground mt-2">
              Commence à générer tes pubs UGC en quelques minutes
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-5">
            {error && (
              <div className="p-4 text-sm text-destructive bg-destructive/5 border border-destructive/10 rounded-xl flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-destructive text-xs">!</span>
                </div>
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="ton@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-foreground focus:bg-background transition-all"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-foreground focus:bg-background transition-all"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-foreground focus:bg-background transition-all"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl font-medium text-base group"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Création...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Créer mon compte
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </Button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              Déjà un compte ?{' '}
              <Link href="/login" className="text-foreground font-medium hover:underline underline-offset-4">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
