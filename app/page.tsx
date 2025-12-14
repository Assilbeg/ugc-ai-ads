import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { 
  Play, 
  Sparkles, 
  Zap, 
  Clock, 
  DollarSign, 
  TrendingUp,
  Check,
  ArrowRight,
  Video,
  Users,
  Mic,
  Palette,
  Globe,
  BarChart3,
  Shield,
  Star,
  ChevronRight
} from 'lucide-react'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center">
                <Play className="w-4 h-4 text-background fill-background" />
              </div>
              <span className="font-bold text-xl">UGC AI</span>
            </div>

            {/* Nav Links */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Fonctionnalités
              </a>
              <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Comment ça marche
              </a>
              <a href="#styles" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Styles
              </a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Tarifs
              </a>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              {user ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center h-10 px-5 bg-foreground text-background rounded-full text-sm font-medium hover:bg-foreground/90 transition-colors"
                >
                  Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="hidden sm:inline-flex items-center justify-center h-10 px-5 text-sm font-medium hover:text-foreground/80 transition-colors"
                  >
                    Connexion
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center h-10 px-5 bg-foreground text-background rounded-full text-sm font-medium hover:bg-foreground/90 transition-colors"
                  >
                    Essai gratuit
                    <Sparkles className="w-4 h-4 ml-2" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-full text-sm mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-muted-foreground">Propulsé par l&apos;IA la plus avancée</span>
              <span className="px-2 py-0.5 bg-foreground text-background text-xs font-medium rounded-full">Nouveau</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              Créez des vidéos UGC{' '}
              <span className="bg-gradient-to-r from-violet-600 via-pink-500 to-orange-400 bg-clip-text text-transparent">
                illimitées
              </span>
              <br />
              en quelques minutes
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              Plus besoin de créateurs coûteux ou de tournages complexes. 
              Notre IA génère des vidéos UGC authentiques qui convertissent, 
              pour <strong className="text-foreground">10x moins cher</strong> et <strong className="text-foreground">100x plus vite</strong>.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
              <Link
                href="/register"
                className="inline-flex items-center justify-center h-14 px-8 bg-foreground text-background rounded-full text-base font-medium hover:bg-foreground/90 transition-all hover:scale-105 shadow-lg shadow-foreground/25"
              >
                Commencer gratuitement
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center justify-center h-14 px-8 border border-border rounded-full text-base font-medium hover:bg-muted transition-colors group"
              >
                <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Voir une démo
              </a>
            </div>

            {/* Social Proof */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-muted to-muted-foreground/20 border-2 border-background" />
                  ))}
                </div>
                <span>+2,500 créateurs</span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-border" />
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
                <span className="ml-1">4.9/5 sur 500+ avis</span>
              </div>
            </div>
          </div>

          {/* Hero Visual - Video Preview Grid */}
          <div className="mt-20 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
              {['🛏️ Confession', '☀️ Morning', '🚶 Street', '🛋️ Testimonial'].map((style, i) => (
                <div
                  key={i}
                  className="aspect-[9/16] rounded-2xl bg-gradient-to-br from-muted to-muted/50 overflow-hidden relative group animate-in fade-in slide-in-from-bottom-8 duration-700"
                  style={{ animationDelay: `${500 + i * 100}ms` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="text-white font-medium text-sm">{style}</div>
                    <div className="text-white/60 text-xs mt-1">Style UGC</div>
                  </div>
                  <div className="absolute top-4 right-4 w-8 h-8 bg-white/20 backdrop-blur rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="w-4 h-4 text-white fill-white" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Les vidéos UGC sont le format le plus performant...
            </h2>
            <p className="text-xl text-muted-foreground">
              Mais les créer traditionnellement est un <span className="text-red-500 font-semibold">cauchemar</span>
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                icon: DollarSign,
                title: '500€ - 2000€ par vidéo',
                description: 'Le coût moyen d\'un créateur UGC pour une seule vidéo de 30 secondes',
                color: 'text-red-500 bg-red-500/10'
              },
              {
                icon: Clock,
                title: '2-4 semaines de délai',
                description: 'Entre le brief, les allers-retours, le tournage et les modifications',
                color: 'text-red-500 bg-red-500/10'
              },
              {
                icon: TrendingUp,
                title: 'Impossible à scaler',
                description: 'Tester 50 angles différents pour trouver celui qui convertit ? Irréaliste.',
                color: 'text-red-500 bg-red-500/10'
              },
            ].map((item, i) => (
              <div key={i} className="bg-background rounded-2xl p-6 border border-border">
                <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center mb-4`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-600 rounded-full text-sm mb-6">
              <Zap className="w-4 h-4" />
              La solution
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Générez des vidéos UGC en quelques clics
            </h2>
            <p className="text-xl text-muted-foreground">
              Notre IA crée des vidéos authentiques avec des acteurs virtuels ultra-réalistes, 
              des scripts optimisés pour la conversion, et un rendu professionnel.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Users,
                title: 'Acteurs IA réalistes',
                description: 'Des avatars qui parlent, bougent et expriment des émotions de manière naturelle. Choisissez parmi notre bibliothèque ou créez le vôtre.',
                gradient: 'from-violet-500 to-purple-600'
              },
              {
                icon: Mic,
                title: 'Voix clonées naturelles',
                description: 'Des voix qui sonnent vraies, avec les intonations et le rythme du parler authentique. Parfait pour le format TikTok/Reels.',
                gradient: 'from-pink-500 to-rose-600'
              },
              {
                icon: Palette,
                title: '7 styles d\'intention',
                description: 'Confession intime, Street Hype, Morning Discovery, Testimonial... Chaque style est optimisé pour un type de message.',
                gradient: 'from-orange-500 to-amber-600'
              },
              {
                icon: Video,
                title: 'Multi-clips automatiques',
                description: 'L\'IA découpe intelligemment votre vidéo en clips avec différents angles, expressions et contextes pour un rendu dynamique.',
                gradient: 'from-cyan-500 to-blue-600'
              },
              {
                icon: Globe,
                title: '10 langues supportées',
                description: 'Français, anglais, espagnol, allemand, italien, portugais... Scalez vos campagnes à l\'international sans effort.',
                gradient: 'from-green-500 to-emerald-600'
              },
              {
                icon: BarChart3,
                title: 'Scripts optimisés conversion',
                description: 'Structure Hook → Problem → Solution → CTA. Chaque script suit les frameworks qui ont fait leurs preuves sur les réseaux.',
                gradient: 'from-indigo-500 to-violet-600'
              },
            ].map((feature, i) => (
              <div key={i} className="group bg-muted/30 hover:bg-muted/50 rounded-2xl p-6 border border-border/50 hover:border-border transition-all">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              3 étapes pour votre première vidéo
            </h2>
            <p className="text-xl text-muted-foreground">
              De l&apos;idée à la vidéo finale en moins de 5 minutes
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: '01',
                title: 'Choisissez votre acteur',
                description: 'Sélectionnez parmi notre bibliothèque d\'acteurs IA ou créez un avatar personnalisé qui représente votre marque.',
                visual: '👤'
              },
              {
                step: '02',
                title: 'Décrivez votre produit',
                description: 'Expliquez ce que vous vendez, le problème que vous résolvez, et l\'audience cible. L\'IA s\'occupe du script.',
                visual: '✍️'
              },
              {
                step: '03',
                title: 'Générez et téléchargez',
                description: 'Choisissez un style, lancez la génération, et obtenez votre vidéo UGC prête à être publiée.',
                visual: '🎬'
              },
            ].map((item, i) => (
              <div key={i} className="relative">
                {i < 2 && (
                  <div className="hidden md:block absolute top-16 left-full w-full h-px bg-gradient-to-r from-border to-transparent -translate-x-1/2 z-0" />
                )}
                <div className="relative bg-background rounded-2xl p-8 border border-border h-full">
                  <div className="text-6xl mb-6">{item.visual}</div>
                  <div className="text-sm font-bold text-muted-foreground mb-2">ÉTAPE {item.step}</div>
                  <h3 className="font-semibold text-xl mb-3">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Styles Section */}
      <section id="styles" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              7 styles de vidéos UGC
            </h2>
            <p className="text-xl text-muted-foreground">
              Chaque intention est optimisée pour un contexte et un message spécifique
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { emoji: '🛏️', name: 'Confession intime', tone: 'Vulnérable', desc: 'Partage personnel comme à un ami proche' },
              { emoji: '☀️', name: 'Morning Discovery', tone: 'Énergique', desc: 'Tu viens de découvrir un truc génial' },
              { emoji: '🚶', name: 'Street Hype', tone: 'Urgent', desc: 'En mouvement, mode FOMO activé' },
              { emoji: '🛋️', name: 'Chill Testimonial', tone: 'Authentique', desc: 'Témoignage détendu sur le canapé' },
              { emoji: '🚗', name: 'Car Confession', tone: 'Sincère', desc: 'Moment de vérité dans la voiture' },
              { emoji: '📦', name: 'Unboxing', tone: 'Excité', desc: 'Focus produit avec démonstration' },
              { emoji: '📖', name: 'Story Journey', tone: 'Narratif', desc: 'Multi-lieux, raconte ton parcours' },
              { emoji: '✨', name: 'Custom', tone: 'Personnalisé', desc: 'Bientôt : créez vos propres styles' },
            ].map((style, i) => (
              <div key={i} className="group bg-muted/30 hover:bg-muted/50 rounded-2xl p-5 border border-border/50 hover:border-border transition-all cursor-pointer">
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">{style.emoji}</div>
                <h3 className="font-semibold mb-1">{style.name}</h3>
                <div className="text-xs text-muted-foreground mb-2 px-2 py-0.5 bg-muted rounded-full inline-block">{style.tone}</div>
                <p className="text-sm text-muted-foreground">{style.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Pourquoi choisir l&apos;IA ?
            </h2>
            <p className="text-xl text-muted-foreground">
              Comparatif objectif avec les créateurs UGC traditionnels
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div></div>
              <div className="bg-muted rounded-xl p-4 text-center">
                <div className="font-semibold text-muted-foreground">Créateur UGC</div>
              </div>
              <div className="bg-foreground rounded-xl p-4 text-center">
                <div className="font-semibold text-background flex items-center justify-center gap-2">
                  UGC AI
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
            </div>

            {[
              { label: 'Coût par vidéo', traditional: '500€ - 2000€', ai: 'À partir de 5€', winner: 'ai' },
              { label: 'Délai de livraison', traditional: '2-4 semaines', ai: '< 5 minutes', winner: 'ai' },
              { label: 'Variations A/B', traditional: 'Payantes (+500€)', ai: 'Illimitées', winner: 'ai' },
              { label: 'Disponibilité', traditional: 'Selon agenda', ai: '24/7', winner: 'ai' },
              { label: 'Modifications', traditional: 'Coûteuses', ai: 'Gratuites', winner: 'ai' },
              { label: 'Langues', traditional: '1-2 max', ai: '10 langues', winner: 'ai' },
              { label: 'Scalabilité', traditional: 'Limitée', ai: 'Infinie', winner: 'ai' },
            ].map((row, i) => (
              <div key={i} className="grid grid-cols-3 gap-4 mb-2">
                <div className="bg-background rounded-xl p-4 flex items-center">
                  <span className="font-medium text-sm">{row.label}</span>
                </div>
                <div className="bg-background rounded-xl p-4 flex items-center justify-center">
                  <span className="text-sm text-muted-foreground">{row.traditional}</span>
                </div>
                <div className={`rounded-xl p-4 flex items-center justify-center gap-2 ${row.winner === 'ai' ? 'bg-green-500/10 text-green-600' : 'bg-background'}`}>
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">{row.ai}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Calculator Teaser */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-pink-600 rounded-3xl p-8 md:p-12 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
            <div className="relative z-10 max-w-3xl">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Calculez votre ROI
              </h2>
              <p className="text-lg text-white/80 mb-8">
                Si vous dépensez actuellement <strong className="text-white">5 000€/mois</strong> en créateurs UGC, 
                vous pourriez économiser jusqu&apos;à <strong className="text-white">4 500€/mois</strong> tout en 
                produisant <strong className="text-white">10x plus de contenu</strong>.
              </p>
              <div className="grid sm:grid-cols-3 gap-6 mb-8">
                <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
                  <div className="text-4xl font-bold">90%</div>
                  <div className="text-sm text-white/70 mt-1">Réduction des coûts</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
                  <div className="text-4xl font-bold">10x</div>
                  <div className="text-sm text-white/70 mt-1">Plus de contenu</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
                  <div className="text-4xl font-bold">100x</div>
                  <div className="text-sm text-white/70 mt-1">Plus rapide</div>
                </div>
              </div>
              <Link
                href="/register"
                className="inline-flex items-center justify-center h-12 px-8 bg-white text-foreground rounded-full text-base font-medium hover:bg-white/90 transition-colors"
              >
                Essayer gratuitement
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ils ont multiplié leur ROI publicitaire
            </h2>
            <p className="text-xl text-muted-foreground">
              Ce que nos clients disent de UGC AI
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "On dépensait 3000€/mois en créateurs UGC. Maintenant on produit 20x plus de contenu pour 300€. Le ROI est juste dingue.",
                author: "Marie L.",
                role: "CEO, E-commerce Beauté",
                stars: 5
              },
              {
                quote: "La qualité des vidéos est bluffante. Nos viewers ne font pas la différence avec de vrais créateurs. Et on peut tester 50 angles en une journée.",
                author: "Thomas B.",
                role: "Growth Manager, SaaS",
                stars: 5
              },
              {
                quote: "Game changer pour notre acquisition. On a réduit notre CPA de 40% en testant massivement différents hooks avec UGC AI.",
                author: "Sophie M.",
                role: "Head of Acquisition, D2C",
                stars: 5
              },
            ].map((testimonial, i) => (
              <div key={i} className="bg-background rounded-2xl p-6 border border-border">
                <div className="flex gap-1 mb-4">
                  {Array(testimonial.stars).fill(0).map((_, j) => (
                    <Star key={j} className="w-5 h-5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-foreground mb-6 leading-relaxed">&ldquo;{testimonial.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-muted to-muted-foreground/20" />
                  <div>
                    <div className="font-medium text-sm">{testimonial.author}</div>
                    <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Des tarifs transparents
            </h2>
            <p className="text-xl text-muted-foreground">
              Payez uniquement ce que vous utilisez, ou économisez avec un abonnement
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: 'Starter',
                price: '0€',
                period: 'pour commencer',
                description: 'Parfait pour tester la plateforme',
                features: [
                  '3 vidéos gratuites',
                  'Tous les styles disponibles',
                  'Export HD 1080p',
                  'Support email',
                ],
                cta: 'Commencer gratuitement',
                highlight: false
              },
              {
                name: 'Pro',
                price: '99€',
                period: '/mois',
                description: 'Pour les équipes marketing actives',
                features: [
                  '50 vidéos/mois',
                  'Acteurs personnalisés',
                  'Export 4K',
                  'Priorité génération',
                  'Support prioritaire',
                  'API access',
                ],
                cta: 'Démarrer l\'essai Pro',
                highlight: true
              },
              {
                name: 'Enterprise',
                price: 'Sur mesure',
                period: '',
                description: 'Pour les grandes équipes',
                features: [
                  'Vidéos illimitées',
                  'Acteurs sur mesure',
                  'White-label possible',
                  'SLA garanti',
                  'Account manager dédié',
                  'Formation équipe',
                ],
                cta: 'Contacter les ventes',
                highlight: false
              },
            ].map((plan, i) => (
              <div key={i} className={`rounded-2xl p-6 border ${plan.highlight ? 'bg-foreground text-background border-foreground ring-4 ring-foreground/20' : 'bg-background border-border'}`}>
                <div className="mb-4">
                  <h3 className={`font-semibold text-lg ${plan.highlight ? 'text-background' : ''}`}>{plan.name}</h3>
                  <p className={`text-sm mt-1 ${plan.highlight ? 'text-background/70' : 'text-muted-foreground'}`}>{plan.description}</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className={`text-sm ${plan.highlight ? 'text-background/70' : 'text-muted-foreground'}`}>{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <Check className={`w-4 h-4 ${plan.highlight ? 'text-green-400' : 'text-green-500'}`} />
                      <span className={plan.highlight ? 'text-background/90' : ''}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`flex items-center justify-center w-full h-11 rounded-xl font-medium text-sm transition-colors ${
                    plan.highlight 
                      ? 'bg-background text-foreground hover:bg-background/90' 
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {plan.cta}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust/Security Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="w-5 h-5" />
              <span className="text-sm font-medium">RGPD Compliant</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="w-5 h-5" />
              <span className="text-sm font-medium">Données chiffrées</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="w-5 h-5" />
              <span className="text-sm font-medium">Serveurs EU</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="w-5 h-5" />
              <span className="text-sm font-medium">Support 24/7</span>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Prêt à révolutionner votre création de contenu ?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Rejoignez les +2,500 marques qui produisent déjà leur contenu UGC avec l&apos;IA. 
            3 vidéos gratuites, sans carte bancaire.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center justify-center h-14 px-8 bg-foreground text-background rounded-full text-base font-medium hover:bg-foreground/90 transition-all hover:scale-105 shadow-lg shadow-foreground/25"
            >
              Créer ma première vidéo
              <Sparkles className="w-5 h-5 ml-2" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center h-14 px-8 text-base font-medium hover:text-foreground/80 transition-colors"
            >
              J&apos;ai déjà un compte
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center">
                  <Play className="w-4 h-4 text-background fill-background" />
                </div>
                <span className="font-bold text-xl">UGC AI</span>
              </div>
              <p className="text-sm text-muted-foreground">
                La plateforme de génération de vidéos UGC par intelligence artificielle.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Fonctionnalités</a></li>
                <li><a href="#styles" className="hover:text-foreground transition-colors">Styles de vidéos</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Tarifs</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Ressources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Guides</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Exemples</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Changelog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Légal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Mentions légales</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">CGU</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Politique de confidentialité</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground">
              © 2024 UGC AI. Tous droits réservés.
            </p>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
