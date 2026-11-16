import type { Metadata } from 'next';
import ProfileClientView from './ProfileClientView';
import { STATIC_PROFILES } from '@/lib/profiles';

export async function generateStaticParams() {
  return Object.keys(STATIC_PROFILES).map((username) => ({
    username,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const cleanUsername = (username || 'aurostron').toLowerCase().replace(/^@+/, '');
  const profile = STATIC_PROFILES[cleanUsername];

  const displayName = profile?.displayName || cleanUsername;
  const bio = profile?.bio || `Contributor portfolio for @${cleanUsername} on OpenLyryc`;
  const title = `${displayName} (@${cleanUsername}) — OpenLyryc`;

  return {
    title,
    description: bio,
    openGraph: {
      title,
      description: bio,
      siteName: 'OpenLyryc',
      type: 'profile',
      images: [
        {
          url: '/openlyryc.png',
          width: 1200,
          height: 630,
          alt: `${displayName} on OpenLyryc`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: bio,
      images: ['/openlyryc.png'],
    },
  };
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <ProfileClientView initialUsername={username} />;
}
