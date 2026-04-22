// Spec 3.6 - Quest & Badge (Gamification) izleme sayfasi.
// Seed ile yuklenmis 12 trigger okur (backend /admin/quests endpoint'i eklendiginde).
export default function QuestsPage() {
  const triggers = [
    { trigger: 'USER_REGISTERED', reward: 'XP +50 / Badge: Yeni Bakir', description: 'Yeni uyelik' },
    { trigger: 'FIRST_POST_CREATED', reward: 'XP +100', description: 'Ilk gonderi' },
    { trigger: 'FIRST_STORY_SHARED', reward: 'XP +75', description: 'Ilk hikaye' },
    { trigger: 'PARTY_JOINED_FIRST_TIME', reward: 'XP +150 / Badge: Takim Oyuncusu', description: 'Ilk parti' },
    { trigger: 'PARTY_COMPLETED_10KM', reward: 'XP +200', description: '10km tamamlama' },
    { trigger: 'RIDE_100KM_TOTAL', reward: 'Badge: Gezgin', description: '100km toplam surus' },
    { trigger: 'RIDE_500KM_TOTAL', reward: 'Badge: Yolcu', description: '500km toplam surus' },
    { trigger: 'RIDE_1000KM_TOTAL', reward: 'Badge: Asi', description: '1000km toplam surus' },
    { trigger: 'EMERGENCY_HELP_PROVIDED', reward: 'XP +500 / Badge: Kurtarici', description: 'SOS yardimi' },
    { trigger: 'STREAK_7_DAYS', reward: 'XP +150', description: '7 gun ust uste aktif' },
    { trigger: 'MOTORCYCLE_ADDED', reward: 'XP +50', description: 'Garaja motor ekleme' },
    { trigger: 'FOLLOWERS_100', reward: 'Badge: Topluluk Lideri', description: '100 takipci' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Quest ve Rozetler</h1>
        <p className="text-sm text-textMuted">
          Spec 3.6 - 12 tetikleyici. Kullanici aksiyonlari bu listeye gore XP + badge kazandirir.
        </p>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-textMuted">
              <th className="px-4 py-3">Trigger</th>
              <th className="px-4 py-3">Aciklama</th>
              <th className="px-4 py-3">Odul</th>
            </tr>
          </thead>
          <tbody>
            {triggers.map((t) => (
              <tr key={t.trigger} className="table-row">
                <td className="px-4 py-3 font-mono text-xs">{t.trigger}</td>
                <td className="px-4 py-3">{t.description}</td>
                <td className="px-4 py-3 text-accent">{t.reward}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
