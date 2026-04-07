import Link from 'next/link'
import Nav from '@/components/Nav'

const galleryImages = [
  {
    id: 1,
    src: 'https://images.unsplash.com/photo-1590246814883-57c511e5ab65?w=600&q=80',
    alt: 'Realism tattoo portrait',
  },
  {
    id: 2,
    src: 'https://images.unsplash.com/photo-1612459284270-b24de39e3cf3?w=600&q=80',
    alt: 'Surrealism tattoo artwork',
  },
  {
    id: 3,
    src: 'https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?w=600&q=80',
    alt: 'Fine line tattoo detail',
  },
  {
    id: 4,
    src: 'https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?w=600&q=80',
    alt: 'Black and grey realism',
  },
  {
    id: 5,
    src: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600&q=80',
    alt: 'Portrait tattoo detail',
  },
  {
    id: 6,
    src: 'https://images.unsplash.com/photo-1565058379802-bbe93b2f703a?w=600&q=80',
    alt: 'Artistic surrealism piece',
  },
]

export default function HomePage() {
  return (
    <main className="bg-[#080808] min-h-screen">
      <Nav />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-radial from-[#161616] via-[#080808] to-[#080808] opacity-60" />
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#C9A84C]/5 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto animate-fade-in">
          {/* Decorative line */}
          <div className="flex items-center justify-center gap-4 mb-10">
            <div className="w-12 h-px bg-[#C9A84C]/50" />
            <span className="font-jost text-xs tracking-[0.4em] text-[#C9A84C]/70 uppercase">Est. 2014</span>
            <div className="w-12 h-px bg-[#C9A84C]/50" />
          </div>

          <h1 className="font-cormorant text-6xl md:text-8xl lg:text-9xl font-light text-[#DADADA] tracking-wide leading-none mb-6">
            Soulmate
            <br />
            <span className="text-[#C9A84C]">Tattoo</span>
          </h1>

          <p className="font-cormorant text-xl md:text-2xl text-[#DADADA]/60 tracking-[0.3em] uppercase mb-6">
            Realism &amp; Surrealism
          </p>

          <p className="font-jost text-sm md:text-base text-[#DADADA]/50 max-w-xl mx-auto leading-relaxed mb-12 tracking-wide">
            Bespoke tattoo artistry in Dublin. Every piece is a collaboration — a permanent testament to your story,
            rendered in exceptional detail by artist Camo.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/book"
              className="btn-gold inline-block tracking-widest text-sm uppercase min-w-[200px] text-center"
            >
              Book a Session
            </Link>
            <a
              href="#gallery"
              className="btn-outline-gold inline-block tracking-widest text-sm uppercase min-w-[200px] text-center"
            >
              View Portfolio
            </a>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
            <span className="font-jost text-xs tracking-widest text-[#DADADA]/30 uppercase">Scroll</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#C9A84C]/50">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="py-28 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-16">
            <p className="font-jost text-xs tracking-[0.4em] text-[#C9A84C]/70 uppercase mb-4">Portfolio</p>
            <h2 className="section-title">Selected Works</h2>
            <div className="gold-divider mx-auto" />
            <p className="font-jost text-sm text-[#DADADA]/50 max-w-lg mx-auto mt-6 leading-relaxed">
              Each piece is crafted with meticulous attention to detail, blending hyperrealistic technique
              with surrealist vision.
            </p>
          </div>

          {/* Gallery Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
            {galleryImages.map((image) => (
              <div
                key={image.id}
                className="group relative overflow-hidden aspect-square bg-[#161616] cursor-pointer"
              >
                {/* Gradient placeholder */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d]" />

                {/* Image overlay effect */}
                <div
                  className="absolute inset-0 bg-cover bg-center filter grayscale group-hover:grayscale-0 transition-all duration-700 scale-100 group-hover:scale-105"
                  style={{ backgroundImage: `url(${image.src})` }}
                />

                {/* Gold border overlay */}
                <div className="absolute inset-0 border-2 border-transparent group-hover:border-[#C9A84C] transition-all duration-500" />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-[#080808]/60 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-8 h-px bg-[#C9A84C] mx-auto mb-3" />
                    <p className="font-jost text-xs tracking-widest text-[#C9A84C] uppercase">View</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/book"
              className="font-jost text-sm tracking-widest text-[#C9A84C] border-b border-[#C9A84C]/30 pb-1 hover:border-[#C9A84C] transition-colors duration-300 uppercase"
            >
              Book Your Session
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-28 px-6 bg-[#0C0C0C]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left: Artist bio */}
            <div>
              <p className="font-jost text-xs tracking-[0.4em] text-[#C9A84C]/70 uppercase mb-4">The Artist</p>
              <h2 className="section-title mb-2">Camo</h2>
              <div className="gold-divider" />
              <p className="font-jost text-sm text-[#DADADA]/60 leading-relaxed mt-8 mb-6">
                With over a decade of experience in the craft, Camo has developed a distinctive style that
                merges photorealistic portraiture with dreamlike surrealist elements. Born from an obsession
                with detail and the emotional power of imagery, each tattoo is conceived as a unique artwork.
              </p>
              <p className="font-jost text-sm text-[#DADADA]/60 leading-relaxed mb-8">
                Having worked across Europe — from Dublin to Berlin and Barcelona — Camo brings an international
                perspective to every collaboration. The studio offers an intimate, private setting where art
                and conversation merge to create something truly permanent.
              </p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-10">
                {[
                  { number: '500+', label: 'Pieces' },
                  { number: '10', label: 'Years Experience' },
                  { number: '3', label: 'Countries' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[#161616] border border-[#2A2A2A] p-5 text-center">
                    <p className="font-cormorant text-3xl text-[#C9A84C] font-light">{stat.number}</p>
                    <p className="font-jost text-xs text-[#DADADA]/50 tracking-wide mt-1 uppercase">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Quote card + image placeholder */}
            <div className="flex flex-col gap-6">
              {/* Artist image placeholder */}
              <div className="aspect-[4/5] bg-[#161616] border border-[#2A2A2A] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1e1a14] to-[#0d0d0d]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-px h-16 bg-[#C9A84C]/20 mx-auto mb-4" />
                    <p className="font-cormorant text-2xl text-[#C9A84C]/30 font-light">Camo</p>
                    <p className="font-jost text-xs text-[#DADADA]/20 tracking-widest mt-1 uppercase">Artist</p>
                    <div className="w-px h-16 bg-[#C9A84C]/20 mx-auto mt-4" />
                  </div>
                </div>
              </div>

              {/* Quote card */}
              <div className="bg-[#161616] border border-[#2A2A2A] p-8 relative">
                <div className="absolute top-6 left-6 font-cormorant text-5xl text-[#C9A84C]/20 leading-none select-none">&ldquo;</div>
                <blockquote className="font-cormorant text-xl text-[#DADADA]/80 font-light italic leading-relaxed pt-4 pl-4">
                  A tattoo is not just ink on skin. It is a story, a memory, a piece of your soul made visible.
                  I approach every piece as a sacred collaboration.
                </blockquote>
                <div className="flex items-center gap-3 mt-6">
                  <div className="w-8 h-px bg-[#C9A84C]" />
                  <span className="font-jost text-xs tracking-widest text-[#C9A84C] uppercase">Camo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Booking CTA Section */}
      <section className="py-28 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-jost text-xs tracking-[0.4em] text-[#C9A84C]/70 uppercase mb-4">Ready to Begin?</p>
          <h2 className="section-title mb-4">Book Your Session</h2>
          <div className="gold-divider mx-auto" />
          <p className="font-jost text-sm text-[#DADADA]/50 max-w-lg mx-auto mt-8 mb-12 leading-relaxed">
            Reserve your date with a €50 deposit. The remaining balance is settled on the day of your session.
            All consultations are complimentary.
          </p>

          {/* Info pills */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
            {[
              { icon: '€', text: '€50 Reservation' },
              { icon: '🕐', text: '12PM – 7PM' },
              { icon: '🔒', text: 'Private Studio' },
              { icon: '✦', text: 'Artist: Camo' },
            ].map((pill) => (
              <div
                key={pill.text}
                className="flex items-center gap-2 bg-[#161616] border border-[#2A2A2A] px-5 py-2.5"
              >
                <span className="text-[#C9A84C] text-xs">{pill.icon}</span>
                <span className="font-jost text-xs tracking-widest text-[#DADADA]/70 uppercase">{pill.text}</span>
              </div>
            ))}
          </div>

          <Link
            href="/book"
            className="btn-gold inline-block tracking-widest text-sm uppercase min-w-[220px] text-center"
          >
            Book Now
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2A2A2A] py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="font-cormorant text-lg font-light tracking-[0.2em] text-[#DADADA]/60">
            SOULMATE TATTOO
          </p>

          {/* Instagram icon */}
          <a
            href="https://instagram.com/soulmatetattoo"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#DADADA]/40 hover:text-[#C9A84C] transition-colors duration-300"
            aria-label="Instagram"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
            </svg>
          </a>

          <p className="font-jost text-xs tracking-widest text-[#DADADA]/30 uppercase">
            © 2024 Soulmate Tattoo. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  )
}
