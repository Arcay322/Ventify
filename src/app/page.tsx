import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, Package, BarChart3, FileText, CheckCircle } from 'lucide-react';
import Image from 'next/image';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link href="/" className="text-2xl font-bold text-primary font-headline">
            Ventify
          </Link>
          <nav className="hidden md:flex gap-6 items-center">
            <Link href="#features" className="text-sm font-medium hover:text-primary transition-colors">
              Características
            </Link>
            <Link href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">
              Precios
            </Link>
            <Button asChild variant="outline">
              <Link href="/auth/login">Iniciar Sesión</Link>
            </Button>
            <Button asChild style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
              <Link href="/auth/signup">Comenzar</Link>
            </Button>
          </nav>
          <Button className="md:hidden" variant="ghost" size="icon" aria-label="Abrir menú">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
          </Button>
        </div>
      </header>

      <main className="flex-grow">
        <section className="py-20 md:py-32">
          <div className="container mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground font-headline">
              Optimiza tu Negocio con Ventify
            </h1>
            <p className="mt-4 max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground">
              Un sistema completo de Punto de Venta (PDV) y gestión de inventario diseñado para ayudar a tu negocio a prosperar.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Button asChild size="lg" style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
                <Link href="/auth/signup">Comienza Prueba Gratis</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#features">Saber Más</Link>
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className="py-20 bg-card">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold font-headline">Plataforma Todo en Uno</h2>
              <p className="mt-3 max-w-2xl mx-auto text-lg text-muted-foreground">
                Todo lo que necesitas para gestionar tus ventas, productos e inventario de forma eficiente.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <FeatureCard
                icon={<ShoppingCart className="w-8 h-8 text-primary" />}
                title="Procesamiento de Ventas"
                description="Procesa ventas y pagos sin esfuerzo con nuestra intuitiva interfaz de PDV."
              />
              <FeatureCard
                icon={<Package className="w-8 h-8 text-primary" />}
                title="Catálogo de Productos"
                description="Gestiona tus productos, categorías y precios con facilidad."
              />
              <FeatureCard
                icon={<BarChart3 className="w-8 h-8 text-primary" />}
                title="Monitoreo de Inventario"
                description="Haz un seguimiento de tu stock en tiempo real y obtén sugerencias inteligentes para reordenar."
              />
              <FeatureCard
                icon={<FileText className="w-8 h-8 text-primary" />}
                title="Informes de Ventas"
                description="Genera informes de ventas detallados para obtener información valiosa sobre tu negocio."
              />
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Image
                src="https://picsum.photos/600/400"
                alt="Vista previa del dashboard"
                width={600}
                height={400}
                data-ai-hint="dashboard analytics"
                className="rounded-lg shadow-xl"
              />
            </div>
            <div>
              <h3 className="text-3xl font-bold font-headline">Potente, pero Sencillo</h3>
              <p className="mt-4 text-lg text-muted-foreground">
                Nuestra plataforma está repleta de funciones para ayudarte a crecer, pero diseñada para ser simple y fácil de usar. Empieza a funcionar en minutos.
              </p>
              <ul className="mt-6 space-y-4">
                <li className="flex items-start">
                  <CheckCircle className="w-6 h-6 mr-3 mt-1 flex-shrink-0" style={{ color: 'hsl(var(--accent))' }} />
                  <span>
                    <span className="font-semibold">Datos en tiempo real:</span> Toma decisiones informadas con información actualizada al minuto.
                  </span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-6 h-6 mr-3 mt-1 flex-shrink-0" style={{ color: 'hsl(var(--accent))' }} />
                  <span>
                    <span className="font-semibold">Sugerencias con IA:</span> Deja que nuestro sistema inteligente te ayude a reordenar el inventario.
                  </span>
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-6 h-6 mr-3 mt-1 flex-shrink-0" style={{ color: 'hsl(var(--accent))' }} />
                  <span>
                    <span className="font-semibold">Accesible desde cualquier lugar:</span> Basado en la nube para que puedas gestionar tu negocio desde cualquier dispositivo.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>
        
        <section id="pricing" className="py-20 bg-card">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold font-headline">Precios Simples y Transparentes</h2>
              <p className="mt-3 max-w-2xl mx-auto text-lg text-muted-foreground">
                Elige el plan adecuado para tu negocio.
              </p>
            </div>
            <div className="flex justify-center">
                <Card className="w-full max-w-md shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-center text-2xl">Plan Pro</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-5xl font-bold">S/149<span className="text-lg font-normal text-muted-foreground">/mes</span></p>
                        <ul className="mt-6 space-y-3 text-left px-4">
                            <li className="flex items-center"><CheckCircle className="w-5 h-5 mr-3" style={{ color: 'hsl(var(--accent))' }} /> Todas las funciones principales</li>
                            <li className="flex items-center"><CheckCircle className="w-5 h-5 mr-3" style={{ color: 'hsl(var(--accent))' }} /> Productos ilimitados</li>
                            <li className="flex items-center"><CheckCircle className="w-5 h-5 mr-3" style={{ color: 'hsl(var(--accent))' }} /> Transacciones de venta ilimitadas</li>
                            <li className="flex items-center"><CheckCircle className="w-5 h-5 mr-3" style={{ color: 'hsl(var(--accent))' }} /> Soporte prioritario</li>
                        </ul>
                        <Button size="lg" className="w-full mt-8" style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
                            Elegir Plan
                        </Button>
                    </CardContent>
                </Card>
            </div>
          </div>
        </section>

      </main>

      <footer className="border-t">
        <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Ventify. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <Link href="#" className="hover:text-primary">Política de Privacidad</Link>
            <Link href="#" className="hover:text-primary">Términos de Servicio</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="flex justify-center items-center mb-4">
        <div className="bg-primary/10 p-4 rounded-full">
          {icon}
        </div>
      </div>
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="mt-2 text-muted-foreground">{description}</p>
    </div>
  );
}
