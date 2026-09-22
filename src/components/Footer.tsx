import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { Zap, Mail, MapPin, Instagram, Twitter, Linkedin, Github } from 'lucide-react';

const columns: { title: string; links: { label: string; to?: string }[] }[] = [
  {
    title: 'Platform',
    links: [
      { label: 'Find Talent', to: '/skills' },
      { label: 'Browse Activities', to: '/activities' },
      { label: 'Meet People', to: '/people' },
      { label: 'Campus Pulse', to: '#campus-pulse' },
    ],
  },
  {
    title: 'For Students',
    links: [
      { label: 'Offer a Skill', to: '/skills' },
      { label: 'Organize an Event', to: '/activities' },
      { label: 'Share a Project', to: '/people' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About RNSIT' },
      { label: 'Team' },
      { label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service' },
      { label: 'Privacy Policy' },
      { label: 'Student Guidelines' },
    ],
  },
];

const socials = [Instagram, Twitter, Linkedin, Github];

const Footer = () => {
  return (
    <footer
      id="contact"
      className="relative z-10 scroll-mt-20"
      style={{
        borderTop: '1px solid hsl(217 90% 61% / 0.25)',
        background:
          'radial-gradient(ellipse 80% 60% at 50% -20%, hsl(217 90% 45% / 0.3), transparent 60%), #14233f',
        '--foreground': '214 20% 94%',
        '--muted-foreground': '214 16% 80%',
      } as CSSProperties}
    >
      <NebulaBorder />
      <div className="container px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-glow">
                <Zap className="h-4 w-4" />
              </span>
              <span className="text-lg font-bold tracking-tight text-foreground">
                GTA<span className="text-primary">.</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              The student-run skill exchange for RNS Institute of Technology, Bengaluru.
              Find talent, organize events, and build together — all inside campus.
            </p>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                gta@rnsit.ac.in
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-accent" />
                RNS Institute of Technology, Channasandra, Bengaluru 560098
              </p>
            </div>
            <div className="mt-5 flex items-center gap-2">
              {socials.map((Icon, i) => (
                <a
                  key={i}
                  href="#contact"
                  aria-label="Social link"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-foreground transition-colors hover:border-primary hover:bg-primary/20 hover:text-primary"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.to && link.to.startsWith('/') ? (
                      <Link
                        to={link.to}
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.to ?? '#contact'}
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="footer-end-bar">
        <div className="container flex flex-col items-center justify-between gap-2 px-4 py-3 text-sm sm:flex-row">
          <p>© {new Date().getFullYear()} GTA (Go To App) — RNSIT. All rights reserved.</p>
          <p>Built by students, for students.</p>
        </div>
      </div>
    </footer>
  );
};

const NebulaBorder = () => <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />;

export default Footer;