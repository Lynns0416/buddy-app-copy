import {
  PrismaClient,
  UserRole,
  BuddyStatus,
  BuddyTier,
  MemberType,
  GroupType,
  TourStatus,
  BookingStatus,
  CancellationCategory,
  BookingPool,
} from '@prisma/client'

const prisma = new PrismaClient()

// Load all Firebase accounts from emulator export. Falls back to the tracked
// fixture the emulator is refilled from, so the seed never waits on the
// emulator's first start (both containers start together).
function loadAuthExport() {
  try {
    const live = require('../.firebase/emulators/auth_export/accounts.json')
    if (live.users?.length) return live
  } catch {
    // no export yet
  }
  return require('../docker/firebase/seed/auth_export/accounts.json')
}
const authExport = loadAuthExport()
const adminAccounts = authExport.users.filter((u: any) =>
  u.email.toLowerCase().includes('admin') || u.displayName.toLowerCase().includes('admin')
)
const adminAccount = adminAccounts[0]
const traineeAccounts = authExport.users.filter((u: any) =>
  u.email?.toLowerCase().includes('trainee') || u.displayName?.toLowerCase().includes('trainee')
)
// Roster accounts (see ROSTER below) are in the export so they can log in, but
// their profiles come from ROSTER, not from the generic buddy loop.
const ROSTER_UID_PREFIX = 'seed-buddy-'
const buddyAccounts = authExport.users.filter(
  (u: any) =>
    !adminAccounts.includes(u) && !traineeAccounts.includes(u) && !u.localId.startsWith(ROSTER_UID_PREFIX)
)
// Synthetic second admin (always seeded, cannot log in — display only for multi-admin eval demo)
const SEED_ADMIN2_UID = 'seed-admin2-00000000000000000000000'

// Synthetic roster buddies (always seeded). The admin roster, its filters and
// its sorting need more rows than the handful of named Firebase accounts
// provide. Each has an emulator account in docker/firebase/seed
// (`seed-buddy-NN@seed.local`, display name = realName), so any of them can
// log in to see the buddy side at their status and tier.
//
// Tier is a pyramid on purpose — few stars, fewer blackstars. Only active
// and suspended buddies carry a tier; trainee, pending and rejected are
// always null.
//
// memberType is the other axis and is independent of tier: the roster carries
// PLAB members at two different tiers so the admin table shows the two columns
// really do vary separately. Omitted means `buddy`, the column default.
type RosterEntry = {
  realName: string
  displayName: string
  status: BuddyStatus
  tier: BuddyTier | null
  memberType?: MemberType
  languages: string[]
  daysAgo: number
  internalNotes?: string
}

const ROSTER: RosterEntry[] = [
  { realName: '田中 美咲',   displayName: 'みさき',   status: BuddyStatus.active,    tier: BuddyTier.junior,    languages: ['japanese'],                        daysAgo: 40 },
  { realName: '佐藤 健太',   displayName: 'けんた',   status: BuddyStatus.active,    tier: BuddyTier.junior,    languages: ['japanese', 'english'],             daysAgo: 44 },
  { realName: '鈴木 陽子',   displayName: 'ようこ',   status: BuddyStatus.active,    tier: BuddyTier.junior,    languages: ['japanese'],                        daysAgo: 51 },
  { realName: '高橋 大輔',   displayName: 'だいすけ', status: BuddyStatus.active,    tier: BuddyTier.junior,    languages: ['japanese', 'english'],             daysAgo: 58 },
  { realName: '伊藤 さくら', displayName: 'さくら',   status: BuddyStatus.active,    tier: BuddyTier.junior,    languages: ['japanese', 'korean'],              daysAgo: 63 },
  { realName: '渡辺 翔',     displayName: 'しょう',   status: BuddyStatus.active,    tier: BuddyTier.junior,    languages: ['japanese'],                        daysAgo: 70 },
  { realName: '山本 結衣',   displayName: 'ゆい',     status: BuddyStatus.active,    tier: BuddyTier.junior,    languages: ['japanese', 'english'],             daysAgo: 77 },
  { realName: '中村 拓海',   displayName: 'たくみ',   status: BuddyStatus.active,    tier: BuddyTier.junior,    languages: ['japanese'],                        daysAgo: 84 },
  { realName: '小林 愛',     displayName: 'あい',     status: BuddyStatus.active,    tier: BuddyTier.buddy,     languages: ['japanese', 'english'],             daysAgo: 120 },
  { realName: '加藤 直樹',   displayName: 'なおき',   status: BuddyStatus.active,    tier: BuddyTier.buddy,     memberType: MemberType.plab_member, languages: ['japanese'],                        daysAgo: 128 },
  { realName: '吉田 遥',     displayName: 'はるか',   status: BuddyStatus.active,    tier: BuddyTier.buddy,     languages: ['japanese', 'english'],             daysAgo: 135 },
  { realName: '山田 涼太',   displayName: 'りょうた', status: BuddyStatus.active,    tier: BuddyTier.buddy,     languages: ['japanese', 'chinese_simplified'],  daysAgo: 142 },
  { realName: '佐々木 千尋', displayName: 'ちひろ',   status: BuddyStatus.active,    tier: BuddyTier.buddy,     languages: ['japanese', 'english'],             daysAgo: 150 },
  { realName: '山口 悠斗',   displayName: 'ゆうと',   status: BuddyStatus.active,    tier: BuddyTier.buddy,     languages: ['japanese'],                        daysAgo: 158 },
  { realName: '松本 楓',     displayName: 'かえで',   status: BuddyStatus.active,    tier: BuddyTier.buddy,     languages: ['japanese', 'english'],             daysAgo: 165 },
  { realName: '井上 蓮',     displayName: 'れん',     status: BuddyStatus.active,    tier: BuddyTier.buddy,     languages: ['japanese', 'korean'],              daysAgo: 172 },
  { realName: '木村 綾乃',   displayName: 'あやの',   status: BuddyStatus.active,    tier: BuddyTier.star,      languages: ['japanese', 'english'],             daysAgo: 300 },
  { realName: '林 隼人',     displayName: 'はやと',   status: BuddyStatus.active,    tier: BuddyTier.star,      languages: ['japanese', 'english', 'french'],   daysAgo: 340 },
  { realName: '清水 芽衣',   displayName: 'めい',     status: BuddyStatus.active,    tier: BuddyTier.blackstar, languages: ['japanese', 'english'],             daysAgo: 520, internalNotes: '研修セッションの担当可。オンライン・オフラインとも対応。' },
  { realName: '斎藤 光',     displayName: 'ひかる',   status: BuddyStatus.active,    tier: BuddyTier.blackstar, memberType: MemberType.plab_member, languages: ['japanese', 'english', 'spanish'],  daysAgo: 610, internalNotes: '統括担当。緊急時の連絡先。' },
  { realName: '森田 奈々',   displayName: 'なな',     status: BuddyStatus.suspended, tier: BuddyTier.junior,    languages: ['japanese'],                        daysAgo: 95,  internalNotes: '本人希望により一時停止中。' },
  { realName: '池田 亮',     displayName: 'りょう',   status: BuddyStatus.suspended, tier: BuddyTier.star,      languages: ['japanese', 'english'],             daysAgo: 380, internalNotes: '留学のため休止。復帰時期は未定。' },
  { realName: '橋本 詩織',   displayName: 'しおり',   status: BuddyStatus.trainee,   tier: null,                languages: ['japanese'],                        daysAgo: 12 },
  { realName: '石川 湊',     displayName: 'みなと',   status: BuddyStatus.trainee,   tier: null,                languages: ['japanese', 'english'],             daysAgo: 15 },
  { realName: '前田 心春',   displayName: 'こはる',   status: BuddyStatus.trainee,   tier: null,                languages: ['japanese'],                        daysAgo: 19 },
  { realName: '藤田 悠真',   displayName: 'ゆうま',   status: BuddyStatus.trainee,   tier: null,                languages: ['japanese', 'english'],             daysAgo: 24 },
  { realName: '岡田 莉子',   displayName: 'りこ',     status: BuddyStatus.pending,   tier: null,                languages: ['japanese'],                        daysAgo: 2 },
  { realName: '後藤 陽向',   displayName: 'ひなた',   status: BuddyStatus.pending,   tier: null,                languages: ['japanese', 'english'],             daysAgo: 4 },
  { realName: '村上 結菜',   displayName: 'ゆな',     status: BuddyStatus.pending,   tier: null,                languages: ['japanese', 'thai'],                daysAgo: 6 },
  { realName: '近藤 大和',   displayName: 'やまと',   status: BuddyStatus.rejected,  tier: null,                languages: ['japanese'],                        daysAgo: 30, internalNotes: '面談に来られず。再応募は可。' },
]

const rosterUid = (i: number) => `${ROSTER_UID_PREFIX}${String(i + 1).padStart(2, '0')}`

const FIREBASE_UIDS = [
  ...authExport.users.map((u: any) => u.localId),
  SEED_ADMIN2_UID,
  ...ROSTER.map((_, i) => rosterUid(i)),
]
// ↑ includes trainee and roster UIDs — excludes them from dynamic "me" detection

// Fixed IDs for groups, tours, sessions (never auto-created via login)
const ID = {
  school:           '00000000-0000-0000-0000-000000000001',
  company:          '00000000-0000-0000-0000-000000000002',
  hs1:              '00000000-0000-0000-0000-000000000003',
  hs2:              '00000000-0000-0000-0000-000000000004',
  jhs1:             '00000000-0000-0000-0000-000000000005',
  jhs2:             '00000000-0000-0000-0000-000000000006',
  groupCommunity:   '00000000-0000-0000-0000-000000000007',
  groupOther:       '00000000-0000-0000-0000-000000000008',
  tourUrgent:       '00000000-0000-0000-0001-000000000001',
  tourMidterm:      '00000000-0000-0000-0001-000000000002',
  tourOpen:         '00000000-0000-0000-0001-000000000003',
  tourPast:         '00000000-0000-0000-0001-000000000004',
  tourDraft:        '00000000-0000-0000-0001-000000000005',
  tourCancelled:    '00000000-0000-0000-0001-000000000006',
  tourPeace1:       '00000000-0000-0000-0001-000000000007',
  tourPeace2:       '00000000-0000-0000-0001-000000000008',
  tourPeace3:       '00000000-0000-0000-0001-000000000009',
  tourPeace4:       '00000000-0000-0000-0001-000000000010',
  tourCommunityPast: '00000000-0000-0000-0001-000000000011',
  tourOtherPast:     '00000000-0000-0000-0001-000000000012',
  tourVoicePast:     '00000000-0000-0000-0001-000000000013',
  sessionUrgent:    '00000000-0000-0000-0002-000000000001',
  sessionMidterm:   '00000000-0000-0000-0002-000000000002',
  sessionOpen:      '00000000-0000-0000-0002-000000000003',
  sessionPast:      '00000000-0000-0000-0002-000000000004',
  sessionDraft:     '00000000-0000-0000-0002-000000000005',
  sessionCancelled: '00000000-0000-0000-0002-000000000006',
  sessionPeace1:    '00000000-0000-0000-0002-000000000007',
  sessionPeace2:    '00000000-0000-0000-0002-000000000008',
  sessionPeace3:    '00000000-0000-0000-0002-000000000009',
  sessionPeace4:    '00000000-0000-0000-0002-000000000010',
  sessionOpen2:     '00000000-0000-0000-0002-000000000013',
  sessionCommunityPast: '00000000-0000-0000-0002-000000000011',
  sessionOtherPast:     '00000000-0000-0000-0002-000000000012',
  sessionVoicePast:     '00000000-0000-0000-0002-000000000014',
  placePeacePark:        '00000000-0000-0000-0003-000000000001',
  placeUrakami:          '00000000-0000-0000-0003-000000000002',
  placeAtomicBombMuseum: '00000000-0000-0000-0003-000000000003',
  placeVoice:            '00000000-0000-0000-0003-000000000004',
  spotOpening:          '00000000-0000-0000-0004-000000000001',
  spotIntroduction:     '00000000-0000-0000-0004-000000000002',
  spotHypocenter:       '00000000-0000-0000-0004-000000000003',
  spotGroundLevel:      '00000000-0000-0000-0004-000000000004',
  spotMatsuyamaShelter: '00000000-0000-0000-0004-000000000005',
  spotFountainOfPeace:  '00000000-0000-0000-0004-000000000006',
  spotMonumentAisle:    '00000000-0000-0000-0004-000000000007',
  spotPeaceStatue:      '00000000-0000-0000-0004-000000000008',
  spotClosing:          '00000000-0000-0000-0004-000000000009',
}

function daysFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(0, 0, 0, 0)
  return d
}

function timeOnly(hour: number, minute = 0): Date {
  return new Date(Date.UTC(1970, 0, 1, hour, minute, 0))
}

async function main() {
  // ── Admin user ───────────────────────────────────────────────
  const adminUser = await prisma.user.upsert({
    where: { firebaseUid: adminAccount.localId },
    update: { email: adminAccount.email, role: UserRole.admin },
    create: { firebaseUid: adminAccount.localId, email: adminAccount.email, role: UserRole.admin },
  })

  // ── Admin profile ────────────────────────────────────────────
  await prisma.adminProfile.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      name: adminAccount.displayName ?? adminAccount.email.split('@')[0],
    },
  })

  // ── Synthetic second admin (display-only, cannot log in) ─────
  const admin2User = await prisma.user.upsert({
    where: { firebaseUid: SEED_ADMIN2_UID },
    update: {},
    create: { firebaseUid: SEED_ADMIN2_UID, email: 'admin2@seed.local', role: UserRole.admin },
  })
  await prisma.adminProfile.upsert({
    where: { userId: admin2User.id },
    update: {},
    create: { userId: admin2User.id, name: 'Seed Admin 2' },
  })

  // ── Buddy users and profiles (dynamic from accounts.json) ─────
  // Assign tiers so the application system works: b(0)=junior, b(1)=star, b(2+)=buddy
  const BUDDY_TIER_CYCLE: BuddyTier[] = [BuddyTier.junior, BuddyTier.star, BuddyTier.buddy]
  const buddies: string[] = []
  for (let i = 0; i < buddyAccounts.length; i++) {
    const account = buddyAccounts[i]
    const tier = BUDDY_TIER_CYCLE[i % BUDDY_TIER_CYCLE.length]

    const user = await prisma.user.upsert({
      where: { firebaseUid: account.localId },
      update: { email: account.email, role: UserRole.buddy },
      create: { firebaseUid: account.localId, email: account.email, role: UserRole.buddy },
    })

    const profile = await prisma.buddyProfile.upsert({
      where: { userId: user.id },
      update: {
        displayName: account.displayName ?? account.email.split('@')[0],
        realName: account.displayName ?? '',
        status: BuddyStatus.active,
        tier,
        languages: ['japanese', 'english'],
        skills: [],
      },
      create: {
        userId: user.id,
        status: BuddyStatus.active,
        tier,
        displayName: account.displayName ?? account.email.split('@')[0],
        realName: account.displayName ?? '',
        languages: ['japanese', 'english'],
        skills: [],
      },
    })

    buddies.push(profile.id)
  }

  // ── Trainee users and profiles ───────────────────────────────
  for (const account of traineeAccounts) {
    const user = await prisma.user.upsert({
      where: { firebaseUid: account.localId },
      update: { email: account.email, role: UserRole.buddy },
      create: { firebaseUid: account.localId, email: account.email, role: UserRole.buddy },
    })
    await prisma.buddyProfile.upsert({
      where: { userId: user.id },
      update: {
        displayName: account.displayName ?? account.email.split('@')[0],
        realName: account.displayName ?? '',
        status: BuddyStatus.trainee,
        tier: null,
        languages: ['japanese'],
        skills: [],
      },
      create: {
        userId: user.id,
        status: BuddyStatus.trainee,
        displayName: account.displayName ?? account.email.split('@')[0],
        realName: account.displayName ?? '',
        languages: ['japanese'],
        skills: [],
      },
    })
  }

  // ── Synthetic roster buddies (display-only, cannot log in) ───
  const rosterIds: string[] = []
  for (let i = 0; i < ROSTER.length; i++) {
    const entry = ROSTER[i]
    const uid = rosterUid(i)
    const createdAt = daysFromNow(-entry.daysAgo)

    const user = await prisma.user.upsert({
      where: { firebaseUid: uid },
      update: {},
      create: { firebaseUid: uid, email: `${uid}@seed.local`, role: UserRole.buddy },
    })

    const profile = await prisma.buddyProfile.upsert({
      where: { userId: user.id },
      update: {
        displayName: entry.displayName,
        realName: entry.realName,
        status: entry.status,
        tier: entry.tier,
        memberType: entry.memberType ?? MemberType.buddy,
        languages: entry.languages,
        skills: [],
        internalNotes: entry.internalNotes ?? null,
        createdAt,
      },
      create: {
        userId: user.id,
        displayName: entry.displayName,
        realName: entry.realName,
        status: entry.status,
        tier: entry.tier,
        memberType: entry.memberType ?? MemberType.buddy,
        languages: entry.languages,
        skills: [],
        internalNotes: entry.internalNotes ?? null,
        createdAt,
      },
    })

    rosterIds.push(profile.id)
  }

  // Helper: cycle through buddy IDs for booking distribution
  const b = (i: number) => buddies.length > 0 ? buddies[i % buddies.length] : null

  // Helper: roster profile ID by index into ROSTER
  const r = (i: number) => rosterIds[i]

  // ── Places and Spots ────────────────────────────────────────
  // Only 平和公園 (Peace Park) has named spots today; the other three places
  // are seeded with none, which is the tour-reflection form's single-textarea
  // fallback path (#239).
  await prisma.place.upsert({
    where: { id: ID.placePeacePark },
    update: {},
    create: { id: ID.placePeacePark, nameJa: '平和公園', nameEn: 'Peace Park', sortOrder: 1 },
  })
  await prisma.place.upsert({
    where: { id: ID.placeUrakami },
    update: {},
    create: { id: ID.placeUrakami, nameJa: '浦上天主堂', nameEn: 'Urakami Cathedral', sortOrder: 2 },
  })
  await prisma.place.upsert({
    where: { id: ID.placeAtomicBombMuseum },
    update: {},
    create: { id: ID.placeAtomicBombMuseum, nameJa: '原爆資料館', nameEn: 'Atomic Bomb Museum', sortOrder: 3 },
  })
  await prisma.place.upsert({
    where: { id: ID.placeVoice },
    update: {},
    create: { id: ID.placeVoice, nameJa: 'VOICE', nameEn: 'VOICE', sortOrder: 4 },
  })

  const peaceParkSpots = [
    { id: ID.spotOpening, nameJa: 'オープニング', nameEn: 'Opening', sortOrder: 1 },
    { id: ID.spotIntroduction, nameJa: 'イントロダクション', nameEn: 'Introduction', sortOrder: 2 },
    { id: ID.spotHypocenter, nameJa: '原爆落下中心地碑', nameEn: 'Hypocenter', sortOrder: 3 },
    { id: ID.spotGroundLevel, nameJa: '被爆当時の地層', nameEn: 'Ground level', sortOrder: 4 },
    { id: ID.spotMatsuyamaShelter, nameJa: '松山防空壕', nameEn: 'Matsuyama Air Raid Shelter', sortOrder: 5 },
    { id: ID.spotFountainOfPeace, nameJa: '平和の泉', nameEn: 'Fountain of Peace', sortOrder: 6 },
    { id: ID.spotMonumentAisle, nameJa: 'モニュメントの通路', nameEn: 'Aisle of Monuments & Statues', sortOrder: 7 },
    { id: ID.spotPeaceStatue, nameJa: '平和祈念像', nameEn: 'Peace Statue', sortOrder: 8 },
    { id: ID.spotClosing, nameJa: 'クロージング', nameEn: 'Closing', sortOrder: 9 },
  ]
  for (const spot of peaceParkSpots) {
    await prisma.spot.upsert({
      where: { id: spot.id },
      update: {},
      create: { ...spot, placeId: ID.placePeacePark },
    })
  }

  // ── Groups ──────────────────────────────────────────────────
  await prisma.group.upsert({
    where: { id: ID.school },
    update: {},
    create: {
      id: ID.school,
      name: 'さくら国際高等学校',
      type: GroupType.school,
      contactName: '陳 先生',
      contactEmail: 'chen@sakura-intl.edu',
    },
  })

  await prisma.group.upsert({
    where: { id: ID.company },
    update: {},
    create: {
      id: ID.company,
      name: 'テックグローバル株式会社',
      type: GroupType.company,
      contactName: '朴 様',
      contactEmail: 'park@techglobal.example',
    },
  })

  await prisma.group.upsert({
    where: { id: ID.hs1 },
    update: {},
    create: {
      id: ID.hs1,
      name: '広島県立桜が丘高等学校',
      type: GroupType.school,
      contactName: '山田 先生',
      contactEmail: 'yamada@sakuragaoka-hs.ed.jp',
    },
  })

  await prisma.group.upsert({
    where: { id: ID.hs2 },
    update: {},
    create: {
      id: ID.hs2,
      name: '福岡第一高等学校',
      type: GroupType.school,
      contactName: '鈴木 先生',
      contactEmail: 'suzuki@fukuoka-daiichi-hs.ed.jp',
    },
  })

  await prisma.group.upsert({
    where: { id: ID.jhs1 },
    update: {},
    create: {
      id: ID.jhs1,
      name: '広島市立平和中学校',
      type: GroupType.school,
      contactName: '中村 先生',
      contactEmail: 'nakamura@heiwa-jhs.hiroshima.ed.jp',
    },
  })

  await prisma.group.upsert({
    where: { id: ID.jhs2 },
    update: {},
    create: {
      id: ID.jhs2,
      name: '松山市立南中学校',
      type: GroupType.school,
      contactName: '林 先生',
      contactEmail: 'hayashi@minami-jhs.matsuyama.ed.jp',
    },
  })

  // community and other group types, so far missing from the seed — the
  // buddy stats group-type column and filter had nothing but school/company
  // to show (#253).
  await prisma.group.upsert({
    where: { id: ID.groupCommunity },
    update: {},
    create: {
      id: ID.groupCommunity,
      name: '長崎県被爆者友の会',
      type: GroupType.community,
      contactName: '大石 様',
      contactEmail: 'oishi@nagasaki-community.example',
    },
  })

  await prisma.group.upsert({
    where: { id: ID.groupOther },
    update: {},
    create: {
      id: ID.groupOther,
      name: '海外メディア取材団',
      type: GroupType.other,
      contactName: 'Smith 様',
      contactEmail: 'smith@overseas-media.example',
    },
  })

  // ── Tours (existing) ────────────────────────────────────────
  await prisma.tour.upsert({
    where: { id: ID.tourUrgent },
    update: {},
    create: {
      id: ID.tourUrgent,
      groupId: ID.school,
      status: TourStatus.published,
      tourDate: daysFromNow(3),
      description: '高校生90名を対象としたツアーです。',
      cancellationDeadline: daysFromNow(1),
      notificationOffsets: [7, 1],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionUrgent },
    update: {},
    create: { id: ID.sessionUrgent, tourId: ID.tourUrgent, placeId: ID.placePeacePark, order: 1, meetingTime: timeOnly(9), capacity: 10, participantCount: 90 },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourMidterm },
    update: { bookingOpen: true },
    create: {
      id: ID.tourMidterm,
      groupId: ID.company,
      status: TourStatus.published,
      tourDate: daysFromNow(14),
      bookingOpen: true,
      description: '企業チーム向けのツアーです。',
      cancellationDeadline: daysFromNow(10),
      maybeDeadline: daysFromNow(5),
      notificationOffsets: [14, 3],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionMidterm },
    update: {},
    create: { id: ID.sessionMidterm, tourId: ID.tourMidterm, placeId: ID.placePeacePark, order: 1, meetingTime: timeOnly(13, 30), capacity: 3, participantCount: 12 },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourOpen },
    update: { bookingOpen: true },
    create: {
      id: ID.tourOpen,
      groupId: ID.school,
      status: TourStatus.published,
      tourDate: daysFromNow(30),
      bookingOpen: true,
      description: '中学生向けのツアーです。',
      cancellationDeadline: daysFromNow(24),
      notificationOffsets: [14, 7],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionOpen },
    update: {},
    create: { id: ID.sessionOpen, tourId: ID.tourOpen, placeId: ID.placePeacePark, order: 1, meetingTime: timeOnly(10), capacity: 8, participantCount: 60 },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionOpen2 },
    update: {},
    create: { id: ID.sessionOpen2, tourId: ID.tourOpen, placeId: ID.placePeacePark, order: 2, meetingTime: timeOnly(13), capacity: 5, participantCount: 60 },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourPast },
    update: {},
    create: {
      id: ID.tourPast,
      groupId: ID.company,
      status: TourStatus.completed,
      tourDate: daysFromNow(-30),
      description: '企業向けツアーです',
      cancellationDeadline: daysFromNow(-35),
      notificationOffsets: [],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionPast },
    update: {},
    create: { id: ID.sessionPast, tourId: ID.tourPast, placeId: ID.placePeacePark, order: 1, meetingTime: timeOnly(14), capacity: 3, participantCount: 12 },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourDraft },
    update: {},
    create: {
      id: ID.tourDraft,
      groupId: ID.school,
      status: TourStatus.draft,
      tourDate: daysFromNow(45),
      cancellationDeadline: daysFromNow(40),
      notificationOffsets: [],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionDraft },
    update: {},
    create: { id: ID.sessionDraft, tourId: ID.tourDraft, placeId: ID.placePeacePark, order: 1, meetingTime: timeOnly(9), capacity: 4, participantCount: 12 },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourCancelled },
    update: {},
    create: {
      id: ID.tourCancelled,
      groupId: ID.company,
      status: TourStatus.cancelled,
      tourDate: daysFromNow(7),
      cancellationDeadline: daysFromNow(3),
      notificationOffsets: [],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionCancelled },
    update: {},
    create: { id: ID.sessionCancelled, tourId: ID.tourCancelled, placeId: ID.placePeacePark, order: 1, meetingTime: timeOnly(11), capacity: 3, participantCount: 20 },
  })

  // ── Tours (new — all at 平和公園) ───────────────────────────
  // peace-001: cancellation deadline 2 days ago, tour in 5 days
  await prisma.tour.upsert({
    where: { id: ID.tourPeace1 },
    update: {},
    create: {
      id: ID.tourPeace1,
      groupId: ID.hs1,
      status: TourStatus.published,
      tourDate: daysFromNow(5),
      bookingOpen: false,
      description: '修学旅行生向け平和学習ツアーです。。',
      cancellationDeadline: daysFromNow(-2),
      notificationOffsets: [7, 1],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionPeace1 },
    update: {},
    create: { id: ID.sessionPeace1, tourId: ID.tourPeace1, placeId: ID.placePeacePark, order: 1, meetingTime: timeOnly(9, 30), capacity: 15, participantCount: 120 },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourPeace2 },
    update: {},
    create: {
      id: ID.tourPeace2,
      groupId: ID.jhs1,
      status: TourStatus.published,
      tourDate: daysFromNow(14),
      bookingOpen: true,
      description: '広島市立平和中学校の生徒を対象とした小規模ツアーです。',
      cancellationDeadline: daysFromNow(9),
      maybeDeadline: daysFromNow(5),
      notificationOffsets: [14, 3],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionPeace2 },
    update: {},
    create: { id: ID.sessionPeace2, tourId: ID.tourPeace2, placeId: ID.placePeacePark, order: 1, meetingTime: timeOnly(10), capacity: 4, participantCount: 20 },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourPeace3 },
    update: {},
    create: {
      id: ID.tourPeace3,
      groupId: ID.hs2,
      status: TourStatus.published,
      tourDate: daysFromNow(28),
      bookingOpen: true,
      description: '福岡第一高等学校の修学旅行。',
      cancellationDeadline: daysFromNow(21),
      maybeDeadline: daysFromNow(14),
      notificationOffsets: [14, 7, 3],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionPeace3 },
    update: {},
    create: { id: ID.sessionPeace3, tourId: ID.tourPeace3, placeId: ID.placePeacePark, order: 1, meetingTime: timeOnly(13), capacity: 12, participantCount: 100 },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourPeace4 },
    update: {},
    create: {
      id: ID.tourPeace4,
      groupId: ID.jhs2,
      status: TourStatus.draft,
      tourDate: daysFromNow(50),
      description: '松山市立南中学校の平和学習ツアー（日程調整中）。',
      cancellationDeadline: daysFromNow(44),
      notificationOffsets: [],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionPeace4 },
    update: {},
    create: { id: ID.sessionPeace4, tourId: ID.tourPeace4, placeId: ID.placePeacePark, order: 1, meetingTime: timeOnly(9), capacity: 8, participantCount: 60 },
  })

  // ── Tours (buddy stats seed — #253) ─────────────────────────
  // Completed, off 平和公園, and across a group type each — every other
  // seeded session is at Peace Park with a school or company group, so the
  // stats page's place and group-type columns had only one real value.
  // Two sessions carry startTime/endTime for "hours volunteered"; the third
  // is left without them to keep exercising "sessions without times".
  await prisma.tour.upsert({
    where: { id: ID.tourCommunityPast },
    update: {},
    create: {
      id: ID.tourCommunityPast,
      groupId: ID.groupCommunity,
      status: TourStatus.completed,
      tourDate: daysFromNow(-75),
      description: '被爆者友の会向けツアーです。',
      cancellationDeadline: daysFromNow(-79),
      notificationOffsets: [],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionCommunityPast },
    update: {},
    create: {
      id: ID.sessionCommunityPast,
      tourId: ID.tourCommunityPast,
      placeId: ID.placeUrakami,
      order: 1,
      meetingTime: timeOnly(10),
      startTime: timeOnly(10, 5),
      endTime: timeOnly(11, 50),
      capacity: 10,
      participantCount: 40,
    },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourOtherPast },
    update: {},
    create: {
      id: ID.tourOtherPast,
      groupId: ID.groupOther,
      status: TourStatus.completed,
      tourDate: daysFromNow(-110),
      description: '海外メディアの取材ツアーです。',
      cancellationDeadline: daysFromNow(-114),
      notificationOffsets: [],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionOtherPast },
    update: {},
    create: {
      id: ID.sessionOtherPast,
      tourId: ID.tourOtherPast,
      placeId: ID.placeAtomicBombMuseum,
      order: 1,
      meetingTime: timeOnly(14),
      capacity: 6,
      participantCount: 8,
    },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourVoicePast },
    update: {},
    create: {
      id: ID.tourVoicePast,
      groupId: ID.school,
      status: TourStatus.completed,
      tourDate: daysFromNow(-10),
      description: 'VOICEでの平和学習ツアーです。',
      cancellationDeadline: daysFromNow(-14),
      notificationOffsets: [],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionVoicePast },
    update: {},
    create: {
      id: ID.sessionVoicePast,
      tourId: ID.tourVoicePast,
      placeId: ID.placeVoice,
      order: 1,
      meetingTime: timeOnly(9, 30),
      startTime: timeOnly(9, 35),
      endTime: timeOnly(11, 5),
      capacity: 8,
      participantCount: 30,
    },
  })

  // ── Bookings (skip if no buddies) ───────────────────────────
  if (buddies.length === 0) {
    console.log('  警告: バディがいません。ブッキングをスキップしました。')
  } else {
    // Existing bookings
    const existingBookings = [
      { buddyId: b(0)!, tourId: ID.tourUrgent,    sessionId: ID.sessionUrgent,    status: BookingStatus.confirmed, buddyTier: BuddyTier.junior },
      { buddyId: b(0)!, tourId: ID.tourMidterm,   sessionId: ID.sessionMidterm,   status: BookingStatus.confirmed, buddyTier: BuddyTier.junior },
      { buddyId: b(1)!, tourId: ID.tourMidterm,   sessionId: ID.sessionMidterm,   status: BookingStatus.maybe,     buddyTier: BuddyTier.star },
      { buddyId: b(0)!, tourId: ID.tourPast,      sessionId: ID.sessionPast,      status: BookingStatus.confirmed, buddyTier: BuddyTier.junior },
      { buddyId: b(1)!, tourId: ID.tourCancelled, sessionId: ID.sessionCancelled, status: BookingStatus.confirmed, buddyTier: BuddyTier.star },
    ]
    for (const booking of existingBookings) {
      await prisma.booking.upsert({
        where: { buddyId_sessionId: { buddyId: booking.buddyId, sessionId: booking.sessionId } },
        update: {},
        create: booking,
      })
    }

    // peace-001: confirmed + declined
    await prisma.booking.upsert({
      where: { buddyId_sessionId: { buddyId: b(0)!, sessionId: ID.sessionPeace1 } },
      update: {},
      create: { buddyId: b(0)!, tourId: ID.tourPeace1, sessionId: ID.sessionPeace1, status: BookingStatus.confirmed, buddyTier: BuddyTier.junior },
    })

    const declinedBooking = await prisma.booking.upsert({
      where: { buddyId_sessionId: { buddyId: b(1)!, sessionId: ID.sessionPeace1 } },
      update: {},
      create: { buddyId: b(1)!, tourId: ID.tourPeace1, sessionId: ID.sessionPeace1, status: BookingStatus.declined, buddyTier: BuddyTier.star },
    })
    await prisma.cancellationReason.upsert({
      where: { bookingId: declinedBooking.id },
      update: {},
      create: {
        bookingId: declinedBooking.id,
        category: CancellationCategory.personal,
        freeText: '個人的な事情により参加できなくなりました。大変申し訳ございません。',
        unavoidable: false,
        recordedBy: adminUser.id,
      },
    })

    // peace-002 (direct/legacy bookings — no application)
    const peace2Bookings = [
      { buddyId: b(0)!, tourId: ID.tourPeace2, sessionId: ID.sessionPeace2, status: BookingStatus.confirmed, buddyTier: BuddyTier.junior },
      { buddyId: b(1)!, tourId: ID.tourPeace2, sessionId: ID.sessionPeace2, status: BookingStatus.maybe,     buddyTier: BuddyTier.star },
    ]
    for (const booking of peace2Bookings) {
      await prisma.booking.upsert({
        where: { buddyId_sessionId: { buddyId: booking.buddyId, sessionId: booking.sessionId } },
        update: {},
        create: booking,
      })
    }
    // peace-003 bookings are seeded via Application records below (not direct)
  }

  // ── Evaluations (skip if no buddies) ────────────────────────
  if (buddies.length > 0) {
    // Ensure b(1) also has a confirmed booking on tourPast so TourBuddyEvalSection shows 2 buddies
    if (buddies.length > 1) {
      await prisma.booking.upsert({
        where: { buddyId_sessionId: { buddyId: b(1)!, sessionId: ID.sessionPast } },
        update: {},
        create: { buddyId: b(1)!, tourId: ID.tourPast, sessionId: ID.sessionPast, status: BookingStatus.confirmed, buddyTier: BuddyTier.star },
      })
    }

    // Admin per-tour evaluations for tourPast
    await prisma.adminEvaluation.upsert({
      where: { buddyId_tourId_createdBy: { buddyId: b(0)!, tourId: ID.tourPast, createdBy: adminUser.id } },
      update: {},
      create: {
        buddyId: b(0)!,
        tourId: ID.tourPast,
        createdBy: adminUser.id,
        overallRating: 4,
        overallRatingNote: '安定したパフォーマンスを発揮してくれました。',
        reliability: 5,
        communication: 4,
        groupEngagement: 4,
        memory: 3,
        memoryNote: '一部の歴史的事実に不正確な点がありました。',
        knowledge: 4,
        dedication: 5,
        dialogue: 4,
        adaptability: 3,
        confidence: 4,
        emotionNote: '訪問者の感情に寄り添う対応が印象的でした。',
      },
    })

    if (buddies.length > 1) {
      await prisma.adminEvaluation.upsert({
        where: { buddyId_tourId_createdBy: { buddyId: b(1)!, tourId: ID.tourPast, createdBy: adminUser.id } },
        update: {},
        create: {
          buddyId: b(1)!,
          tourId: ID.tourPast,
          createdBy: adminUser.id,
          overallRating: 3,
          reliability: 3,
          communication: 3,
          groupEngagement: 4,
          knowledge: 3,
          dedication: 3,
          dialogue: 2,
          dialogueNote: '対話の深みが不足していました。',
          adaptability: 4,
          confidence: 3,
        },
      })
    }

    // Admin profile evaluations (admin 1)
    await prisma.adminProfileEvaluation.upsert({
      where: { buddyId_createdBy: { buddyId: b(0)!, createdBy: adminUser.id } },
      update: {},
      create: {
        buddyId: b(0)!,
        createdBy: adminUser.id,
        overallRating: 4,
        overallRatingNote: '全体的に信頼できるバディです。',
        reliability: 5,
        communication: 4,
        groupEngagement: 4,
        memory: 4,
        knowledge: 4,
        dedication: 5,
        dialogue: 4,
        adaptability: 3,
        confidence: 4,
        emotionNote: '共感力が高く、訪問者から好評です。',
      },
    })

    // Admin profile evaluations (admin 2 — synthetic, for multi-admin demo)
    await prisma.adminProfileEvaluation.upsert({
      where: { buddyId_createdBy: { buddyId: b(0)!, createdBy: admin2User.id } },
      update: {},
      create: {
        buddyId: b(0)!,
        createdBy: admin2User.id,
        overallRating: 3,
        overallRatingNote: 'まだ成長の余地があります。',
        reliability: 4,
        communication: 3,
        groupEngagement: 3,
        memory: 3,
        knowledge: 3,
        dedication: 4,
        dialogue: 3,
        adaptability: 3,
        confidence: 3,
      },
    })

    // Per-tour evaluation for tourPast from admin 2 (multi-admin demo)
    await prisma.adminEvaluation.upsert({
      where: { buddyId_tourId_createdBy: { buddyId: b(0)!, tourId: ID.tourPast, createdBy: admin2User.id } },
      update: {},
      create: {
        buddyId: b(0)!,
        tourId: ID.tourPast,
        createdBy: admin2User.id,
        overallRating: 3,
        reliability: 4,
        communication: 3,
        groupEngagement: 3,
        knowledge: 3,
        dedication: 4,
        dialogue: 3,
        adaptability: 3,
        confidence: 3,
        emotionNote: '訪問者への配慮はあるが、より積極的に。',
      },
    })

    // Buddy reflection on the session they guided on tourPast
    await prisma.tourReflection.upsert({
      where: { buddyId_sessionId: { buddyId: b(0)!, sessionId: ID.sessionPast } },
      update: {},
      create: {
        buddyId: b(0)!,
        sessionId: ID.sessionPast,
        didWell: '参加者一人ひとりに声をかけ、緊張をほぐせたと思います。',
        couldImprove: '資料の復習が足りず、年号を一度言い間違えました。',
        openQuestions: '被爆二世の支援制度について聞かれ、答えられませんでした。',
        moments: {
          create: [
            {
              position: 0,
              spotId: ID.spotPeaceStatue,
              description: '「自分の街でも同じことが起きたのかも」と言った生徒がいました。',
            },
          ],
        },
      },
    })
  }

  // ── TierCapacity (sessionPeace3: custom split to demo the feature) ─
  // Default is 20/30/50 — sessionPeace3 uses 25/35/40 as an example override
  if (buddies.length > 0) {
    const customPools: { pool: BookingPool; percent: number }[] = [
      { pool: BookingPool.junior,     percent: 25 },
      { pool: BookingPool.non_junior, percent: 35 },
      { pool: BookingPool.anyone,     percent: 40 },
    ]
    for (const { pool, percent } of customPools) {
      await prisma.tierCapacity.upsert({
        where: { sessionId_pool: { sessionId: ID.sessionPeace3, pool } },
        update: { percent },
        create: { sessionId: ID.sessionPeace3, pool, percent },
      })
    }
  }

  // ── tourPeace3 bookings ─────────────────────────────────────
  if (buddies.length > 0) {
    await prisma.booking.upsert({
      where: { buddyId_sessionId: { buddyId: b(0)!, sessionId: ID.sessionPeace3 } },
      update: {},
      create: { buddyId: b(0)!, tourId: ID.tourPeace3, sessionId: ID.sessionPeace3, status: BookingStatus.confirmed, buddyTier: BuddyTier.junior },
    })
    if (buddies.length > 1) {
      await prisma.booking.upsert({
        where: { buddyId_sessionId: { buddyId: b(1)!, sessionId: ID.sessionPeace3 } },
        update: {},
        create: { buddyId: b(1)!, tourId: ID.tourPeace3, sessionId: ID.sessionPeace3, status: BookingStatus.waitlist, buddyTier: BuddyTier.star },
      })
    }
  }

  // ── Roster bookings ─────────────────────────────────────────
  // A light spread so the tier pools hold real numbers. Only active roster
  // buddies book. sessionPeace3's junior pool is left clear so the dynamic
  // "me" buddy (junior) can still apply there.
  // buddyTier is taken from ROSTER[index].tier — never restated here, so a
  // roster entry and its bookings cannot drift apart.
  const rosterBookings: {
    index: number
    tourId: string
    sessionId: string
    status: BookingStatus
  }[] = [
    // tourPeace4 / sessionPeace4 — capacity 8, previously empty
    { index: 0,  tourId: ID.tourPeace4, sessionId: ID.sessionPeace4, status: BookingStatus.confirmed },
    { index: 8,  tourId: ID.tourPeace4, sessionId: ID.sessionPeace4, status: BookingStatus.confirmed },
    { index: 9,  tourId: ID.tourPeace4, sessionId: ID.sessionPeace4, status: BookingStatus.confirmed },
    { index: 16, tourId: ID.tourPeace4, sessionId: ID.sessionPeace4, status: BookingStatus.confirmed },
    { index: 18, tourId: ID.tourPeace4, sessionId: ID.sessionPeace4, status: BookingStatus.confirmed },
    { index: 10, tourId: ID.tourPeace4, sessionId: ID.sessionPeace4, status: BookingStatus.waitlist },
    { index: 1,  tourId: ID.tourPeace4, sessionId: ID.sessionPeace4, status: BookingStatus.waitlist },
    // tourOpen / sessionOpen — capacity 8, previously empty
    { index: 2,  tourId: ID.tourOpen,   sessionId: ID.sessionOpen,   status: BookingStatus.confirmed },
    { index: 11, tourId: ID.tourOpen,   sessionId: ID.sessionOpen,   status: BookingStatus.confirmed },
    { index: 12, tourId: ID.tourOpen,   sessionId: ID.sessionOpen,   status: BookingStatus.confirmed },
    { index: 17, tourId: ID.tourOpen,   sessionId: ID.sessionOpen,   status: BookingStatus.confirmed },
    // tourPeace3 / sessionPeace3 — non-junior only, junior pool stays clear
    { index: 13, tourId: ID.tourPeace3, sessionId: ID.sessionPeace3, status: BookingStatus.confirmed },
    { index: 14, tourId: ID.tourPeace3, sessionId: ID.sessionPeace3, status: BookingStatus.confirmed },
    { index: 19, tourId: ID.tourPeace3, sessionId: ID.sessionPeace3, status: BookingStatus.confirmed },
  ]

  for (const booking of rosterBookings) {
    const buddyId = r(booking.index)
    const buddyTier = ROSTER[booking.index].tier
    if (!buddyId || !buddyTier) continue
    await prisma.booking.upsert({
      where: { buddyId_sessionId: { buddyId, sessionId: booking.sessionId } },
      update: {},
      create: {
        buddyId,
        tourId: booking.tourId,
        sessionId: booking.sessionId,
        status: booking.status,
        buddyTier,
      },
    })
  }

  // ── Roster history on the buddy-stats tours (#253) ───────────
  // Attendance, a no-show, cancellations covering every review state and
  // every category, a deadline override, evaluations from more than one
  // admin and evaluations left missing, and reflections at a place with no
  // named spots (#239's free-text fallback) — so the buddy stats page and
  // the buddy detail page have more than a couple of buddies' worth of
  // history to show. Every buddy below is chosen so their `daysAgo`
  // registration is well before the tour they're booked on.
  const statsHistoryBookings: {
    index: number
    tourId: string
    sessionId: string
    status: BookingStatus
  }[] = [
    // tourCommunityPast (75 days ago; buddies registered 120+ days ago)
    { index: 8,  tourId: ID.tourCommunityPast, sessionId: ID.sessionCommunityPast, status: BookingStatus.confirmed },
    { index: 10, tourId: ID.tourCommunityPast, sessionId: ID.sessionCommunityPast, status: BookingStatus.confirmed },
    { index: 12, tourId: ID.tourCommunityPast, sessionId: ID.sessionCommunityPast, status: BookingStatus.confirmed },
    { index: 14, tourId: ID.tourCommunityPast, sessionId: ID.sessionCommunityPast, status: BookingStatus.confirmed }, // no-show, below
    { index: 16, tourId: ID.tourCommunityPast, sessionId: ID.sessionCommunityPast, status: BookingStatus.declined },
    { index: 18, tourId: ID.tourCommunityPast, sessionId: ID.sessionCommunityPast, status: BookingStatus.declined },
    // tourOtherPast (110 days ago; buddies registered 128+ days ago)
    { index: 9,  tourId: ID.tourOtherPast, sessionId: ID.sessionOtherPast, status: BookingStatus.confirmed },
    { index: 11, tourId: ID.tourOtherPast, sessionId: ID.sessionOtherPast, status: BookingStatus.confirmed },
    { index: 13, tourId: ID.tourOtherPast, sessionId: ID.sessionOtherPast, status: BookingStatus.confirmed },
    { index: 15, tourId: ID.tourOtherPast, sessionId: ID.sessionOtherPast, status: BookingStatus.declined },
    { index: 17, tourId: ID.tourOtherPast, sessionId: ID.sessionOtherPast, status: BookingStatus.declined }, // deadline override, below
    // tourVoicePast (10 days ago — any active buddy qualifies)
    { index: 0,  tourId: ID.tourVoicePast, sessionId: ID.sessionVoicePast, status: BookingStatus.confirmed },
    { index: 2,  tourId: ID.tourVoicePast, sessionId: ID.sessionVoicePast, status: BookingStatus.confirmed },
    { index: 4,  tourId: ID.tourVoicePast, sessionId: ID.sessionVoicePast, status: BookingStatus.confirmed },
    { index: 6,  tourId: ID.tourVoicePast, sessionId: ID.sessionVoicePast, status: BookingStatus.declined },
  ]
  for (const booking of statsHistoryBookings) {
    const buddyId = r(booking.index)
    const buddyTier = ROSTER[booking.index].tier
    if (!buddyId || !buddyTier) continue
    await prisma.booking.upsert({
      where: { buddyId_sessionId: { buddyId, sessionId: booking.sessionId } },
      update: {},
      create: {
        buddyId,
        tourId: booking.tourId,
        sessionId: booking.sessionId,
        status: booking.status,
        buddyTier,
      },
    })
  }

  // Cancellation reasons — every review state, every lateness case, one of
  // each CancellationCategory.
  const statsCancellationReasons: {
    index: number
    sessionId: string
    category: CancellationCategory
    unavoidable: boolean | null
    createdAt: Date
  }[] = [
    // deadline -79: before it is on time
    { index: 16, sessionId: ID.sessionCommunityPast, category: CancellationCategory.health,    unavoidable: true,  createdAt: daysFromNow(-82) },
    { index: 18, sessionId: ID.sessionCommunityPast, category: CancellationCategory.work,      unavoidable: false, createdAt: daysFromNow(-70) },
    // deadline -114: before it is on time
    { index: 15, sessionId: ID.sessionOtherPast,     category: CancellationCategory.emergency, unavoidable: null,  createdAt: daysFromNow(-116) },
    // after the tour's own deadline (-114) but before r(17)'s override (-108, below) — on time only because of the override
    { index: 17, sessionId: ID.sessionOtherPast,     category: CancellationCategory.other,     unavoidable: false, createdAt: daysFromNow(-112) },
    // deadline -14: after it is late
    { index: 6,  sessionId: ID.sessionVoicePast,     category: CancellationCategory.personal,  unavoidable: false, createdAt: daysFromNow(-9) },
  ]
  for (const reason of statsCancellationReasons) {
    const buddyId = r(reason.index)
    if (!buddyId) continue
    const declined = await prisma.booking.findUnique({ where: { buddyId_sessionId: { buddyId, sessionId: reason.sessionId } } })
    if (!declined) continue
    await prisma.cancellationReason.upsert({
      where: { bookingId: declined.id },
      update: {},
      create: {
        bookingId: declined.id,
        category: reason.category,
        unavoidable: reason.unavoidable,
        recordedBy: adminUser.id,
        createdAt: reason.createdAt,
      },
    })
  }

  // Deadline override for r(17) on tourOtherPast: extends the tour's own
  // deadline (-114) to (-108), so the reason recorded at (-112) above counts
  // as on time only under this override.
  const overrideBuddyId = r(17)
  if (overrideBuddyId) {
    await prisma.buddyCancellationDeadlineOverride.upsert({
      where: { buddyId_tourId: { buddyId: overrideBuddyId, tourId: ID.tourOtherPast } },
      update: {},
      create: {
        buddyId: overrideBuddyId,
        tourId: ID.tourOtherPast,
        deadline: daysFromNow(-108),
        setBy: adminUser.id,
      },
    })
  }

  // No-show: r(14) held a confirmed booking on tourCommunityPast but the
  // evaluation records they never turned up, which voids the session.
  const noShowBuddyId = r(14)
  if (noShowBuddyId) {
    await prisma.adminEvaluation.upsert({
      where: { buddyId_tourId_createdBy: { buddyId: noShowBuddyId, tourId: ID.tourCommunityPast, createdBy: adminUser.id } },
      update: {},
      create: {
        buddyId: noShowBuddyId,
        tourId: ID.tourCommunityPast,
        createdBy: adminUser.id,
        absentWithoutReport: true,
      },
    })
  }

  // Evaluations for buddies who attended, with a spread of scores. r(12),
  // r(13) and r(4) are deliberately left unevaluated, so "tours not
  // evaluated" has something to show. r(2) gets a second evaluation from
  // admin 2, to test averaging across admins outside b(0).
  const statsEvaluations: {
    index: number
    tourId: string
    createdBy: string
    scores: Partial<Record<
      'overallRating' | 'reliability' | 'communication' | 'groupEngagement' | 'memory' | 'knowledge' | 'dedication' | 'dialogue' | 'adaptability' | 'confidence',
      number
    >>
  }[] = [
    { index: 8,  tourId: ID.tourCommunityPast, createdBy: adminUser.id, scores: { overallRating: 4, reliability: 4, communication: 5, groupEngagement: 4 } },
    { index: 10, tourId: ID.tourCommunityPast, createdBy: adminUser.id, scores: { overallRating: 5, reliability: 5, dedication: 5 } },
    { index: 9,  tourId: ID.tourOtherPast,     createdBy: adminUser.id, scores: { overallRating: 4, knowledge: 5, confidence: 4 } },
    { index: 11, tourId: ID.tourOtherPast,     createdBy: adminUser.id, scores: { overallRating: 3, dialogue: 3, memory: 2 } },
    { index: 0,  tourId: ID.tourVoicePast,     createdBy: adminUser.id, scores: { overallRating: 5, reliability: 5, communication: 5, groupEngagement: 5 } },
    { index: 2,  tourId: ID.tourVoicePast,     createdBy: adminUser.id, scores: { overallRating: 4, reliability: 4, communication: 4 } },
    { index: 2,  tourId: ID.tourVoicePast,     createdBy: admin2User.id, scores: { overallRating: 3, reliability: 3, adaptability: 3 } },
  ]
  for (const e of statsEvaluations) {
    const buddyId = r(e.index)
    if (!buddyId) continue
    await prisma.adminEvaluation.upsert({
      where: { buddyId_tourId_createdBy: { buddyId, tourId: e.tourId, createdBy: e.createdBy } },
      update: {},
      create: { buddyId, tourId: e.tourId, createdBy: e.createdBy, ...e.scores },
    })
  }

  // Reflections at places with no named spots (#239's free-text fallback).
  const communityReflectionBuddyId = r(8)
  if (communityReflectionBuddyId) {
    await prisma.tourReflection.upsert({
      where: { buddyId_sessionId: { buddyId: communityReflectionBuddyId, sessionId: ID.sessionCommunityPast } },
      update: {},
      create: {
        buddyId: communityReflectionBuddyId,
        sessionId: ID.sessionCommunityPast,
        didWell: '被爆体験のお話に、参加者が熱心に耳を傾けていました。',
        couldImprove: '浦上天主堂の歴史についての説明がやや駆け足になりました。',
        moments: {
          create: [
            { position: 0, placeNote: '鐘のレプリカの前', description: '「鐘の音を聞いて涙ぐむ方がいました」' },
          ],
        },
      },
    })
  }

  const otherReflectionBuddyId = r(9)
  if (otherReflectionBuddyId) {
    await prisma.tourReflection.upsert({
      where: { buddyId_sessionId: { buddyId: otherReflectionBuddyId, sessionId: ID.sessionOtherPast } },
      update: {},
      create: {
        buddyId: otherReflectionBuddyId,
        sessionId: ID.sessionOtherPast,
        didWell: '海外メディアからの質問に落ち着いて対応できました。',
        openQuestions: '被爆者の平均年齢についての質問に正確な数字を答えられませんでした。',
        moments: {
          create: [
            { position: 0, placeNote: '被爆再現人形の展示前', description: '記者の一人が長時間メモを取っていました。' },
            { position: 1, placeNote: '入口ロビー', description: '通訳を介してでも伝わる反応があったと感じました。' },
          ],
        },
      },
    })
  }

  // ── Realistic multi-tour history and buddy personalities (#253) ─
  // The blocks above cover one example of every code path; this gives the
  // stats page a real-looking population on top of them: most active roster
  // buddies attend regularly and mostly don't cancel, a minority barely
  // join at all, and two independent traits vary per buddy rather than
  // moving together — how they score in their own reflections (`selfView`)
  // and how admins score them (`adminView`); the two are assigned
  // independently on purpose; a buddy can be self-critical yet admin-rated
  // highly, or the reverse. Every buddy below is checked against their own
  // `daysAgo` registration, so no one attends a tour that predates them.
  type BuddyArchetype = {
    index: number
    participation: 'core' | 'occasional'
    selfView: 'critical' | 'confident' | 'balanced'
    adminView: 'high' | 'low' | 'mixed'
  }

  // 15 core (attend most tours) / 5 occasional (a tour or two, ever) — the
  // occasional five are the longest-registered (daysAgo 172-610): tenure
  // does not imply frequency.
  const BUDDY_ARCHETYPES: BuddyArchetype[] = [
    { index: 0,  participation: 'core', selfView: 'critical',  adminView: 'high' },
    { index: 1,  participation: 'core', selfView: 'confident', adminView: 'low' },
    { index: 2,  participation: 'core', selfView: 'balanced',  adminView: 'mixed' },
    { index: 3,  participation: 'core', selfView: 'critical',  adminView: 'low' },
    { index: 4,  participation: 'core', selfView: 'confident', adminView: 'high' },
    { index: 5,  participation: 'core', selfView: 'balanced',  adminView: 'high' },
    { index: 6,  participation: 'core', selfView: 'critical',  adminView: 'mixed' },
    { index: 7,  participation: 'core', selfView: 'confident', adminView: 'mixed' },
    { index: 8,  participation: 'core', selfView: 'balanced',  adminView: 'low' },
    { index: 9,  participation: 'core', selfView: 'critical',  adminView: 'high' },
    { index: 10, participation: 'core', selfView: 'confident', adminView: 'low' },
    { index: 11, participation: 'core', selfView: 'balanced',  adminView: 'mixed' },
    { index: 12, participation: 'core', selfView: 'critical',  adminView: 'low' },
    { index: 13, participation: 'core', selfView: 'confident', adminView: 'high' },
    { index: 14, participation: 'core', selfView: 'balanced',  adminView: 'high' },
    { index: 15, participation: 'occasional', selfView: 'balanced',  adminView: 'mixed' },
    { index: 16, participation: 'occasional', selfView: 'confident', adminView: 'high' },
    { index: 17, participation: 'occasional', selfView: 'critical',  adminView: 'low' },
    { index: 18, participation: 'occasional', selfView: 'balanced',  adminView: 'mixed' },
    { index: 19, participation: 'occasional', selfView: 'critical',  adminView: 'high' },
  ]

  // Five recent completed tours, all within the last 36 days — safely after
  // even the newest core buddy's registration (daysAgo 40) — so every core
  // buddy is eligible for every one of them.
  type Tier1Tour = {
    i: number
    id: string
    sessionId: string
    groupId: string
    placeId: string
    daysAgo: number
    deadlineDaysAgo: number
    description: string
  }
  const TIER1_TOURS: Tier1Tour[] = [
    { i: 0, id: '00000000-0000-0000-0001-000000000021', sessionId: '00000000-0000-0000-0002-000000000021', groupId: ID.school,  placeId: ID.placePeacePark,        daysAgo: 9,  deadlineDaysAgo: 13, description: '高校生向け平和学習ツアーです。' },
    { i: 1, id: '00000000-0000-0000-0001-000000000022', sessionId: '00000000-0000-0000-0002-000000000022', groupId: ID.company, placeId: ID.placeUrakami,          daysAgo: 16, deadlineDaysAgo: 20, description: '企業研修の一環としての訪問です。' },
    { i: 2, id: '00000000-0000-0000-0001-000000000023', sessionId: '00000000-0000-0000-0002-000000000023', groupId: ID.hs2,     placeId: ID.placePeacePark,        daysAgo: 23, deadlineDaysAgo: 27, description: '修学旅行の平和学習ツアーです。' },
    { i: 3, id: '00000000-0000-0000-0001-000000000024', sessionId: '00000000-0000-0000-0002-000000000024', groupId: ID.jhs2,    placeId: ID.placeVoice,            daysAgo: 30, deadlineDaysAgo: 34, description: '中学生向けのVOICE見学ツアーです。' },
    { i: 4, id: '00000000-0000-0000-0001-000000000025', sessionId: '00000000-0000-0000-0002-000000000025', groupId: ID.hs1,     placeId: ID.placeAtomicBombMuseum, daysAgo: 36, deadlineDaysAgo: 40, description: '高校生向けの資料館見学ツアーです。' },
  ]
  for (const tour of TIER1_TOURS) {
    await prisma.tour.upsert({
      where: { id: tour.id },
      update: {},
      create: {
        id: tour.id,
        groupId: tour.groupId,
        status: TourStatus.completed,
        tourDate: daysFromNow(-tour.daysAgo),
        description: tour.description,
        cancellationDeadline: daysFromNow(-tour.deadlineDaysAgo),
        notificationOffsets: [],
      },
    })
    await prisma.tourSession.upsert({
      where: { id: tour.sessionId },
      update: {},
      create: {
        id: tour.sessionId,
        tourId: tour.id,
        placeId: tour.placeId,
        order: 1,
        meetingTime: timeOnly(10),
        startTime: timeOnly(10, 5),
        endTime: timeOnly(11, 45),
        capacity: 6,
        participantCount: 35,
      },
    })
  }

  const SCORE_FIELDS = [
    'overallRating', 'reliability', 'communication', 'groupEngagement', 'memory',
    'knowledge', 'dedication', 'dialogue', 'adaptability', 'confidence',
  ] as const
  type ScoreField = (typeof SCORE_FIELDS)[number]

  // 'high' sits at 5 with the odd 4; 'low' sits at 2 with the odd 1; 'mixed'
  // swings between the two bands by `variant` (the tour index, for a
  // per-tour evaluation, or the buddy index, for the one-off profile
  // rating) — an inconsistent performer, not a uniformly middling one.
  function bandScores(adminView: 'high' | 'low' | 'mixed', variant: number): Partial<Record<ScoreField, number>> {
    const base = adminView === 'high' ? 5 : adminView === 'low' ? 2 : variant % 2 === 0 ? 5 : 2
    const scores: Partial<Record<ScoreField, number>> = {}
    SCORE_FIELDS.forEach((field, i) => {
      const dip = (i + variant) % 3 === 0
      scores[field] = Math.min(5, Math.max(1, base + (dip ? -1 : 0)))
    })
    return scores
  }

  // Reflection tone by self-view, two phrasings each so a buddy's own
  // history doesn't read as one sentence copy-pasted. `selfView` says
  // nothing about `adminView` — see the archetype table above.
  const REFLECTION_TEMPLATES: Record<'critical' | 'confident' | 'balanced', { didWell: string; couldImprove: string }[]> = {
    critical: [
      { didWell: '一通り案内はできましたが、及第点だと思います。', couldImprove: '説明の間に沈黙が多く、参加者を退屈させてしまったかもしれません。次はもっと質問を投げかけたいです。' },
      { didWell: '大きな失敗はありませんでした。', couldImprove: '時間配分がうまくいかず、後半を早口で説明することになってしまいました。反省しています。' },
    ],
    confident: [
      { didWell: '参加者の反応もよく、スムーズに案内できました。', couldImprove: '特にありません。' },
      { didWell: '質問にもテンポよく答えられ、良いツアーになったと思います。', couldImprove: '強いて言えば時間が少し余りましたが、問題はなかったです。' },
    ],
    balanced: [
      { didWell: '導入部分は落ち着いて話せました。', couldImprove: '後半、資料の説明に詰まる場面がありました。次は見直しておきます。' },
      { didWell: '参加者からの質問にはきちんと答えられました。', couldImprove: 'グループ全体への声かけがもう少し必要だったかもしれません。' },
    ],
  }
  function reflectionTemplate(selfView: 'critical' | 'confident' | 'balanced', variant: number) {
    const options = REFLECTION_TEMPLATES[selfView]
    return options[variant % options.length]
  }

  // What each reflection on a TIER1 tour remembers, in the order the
  // reflections are written. Peace Park walks a fixed route, so its moments
  // follow the spots in route order, some reflections naming two or three;
  // no one wrote about the opening or the aisle of monuments, so those show as
  // zero on the reflection stats page. The other places have no spots and get
  // the reflection form's fallback: one moment whose `placeNote` is the
  // place's `nameJa`.
  type SeedMoment = { spotId: string; description: string } | { placeNote: string; description: string }
  const TIER1_MOMENTS: Record<number, SeedMoment[][]> = {
    0: [
      [
        { spotId: ID.spotHypocenter, description: '黒い碑の前で「ここの真上で爆発した」と伝えると、全員が空を見上げました。' },
        { spotId: ID.spotPeaceStatue, description: '像の右手と左手の意味を聞いてきた生徒がいて、説明すると深くうなずいていました。' },
      ],
      [{ spotId: ID.spotGroundLevel, description: '地層の中の瓦やガラスを見て「本当に街があったんだ」とつぶやいた生徒がいました。' }],
      [
        { spotId: ID.spotMatsuyamaShelter, description: '防空壕の狭さに驚いて、何人くらい入れたのかと質問が続きました。' },
        { spotId: ID.spotFountainOfPeace, description: '水を求めた少女の手記を読むと、にぎやかだった班が静かになりました。' },
        { spotId: ID.spotClosing, description: '最後に一人ずつ感想を言ってもらい、「家族に話したい」という声が多かったです。' },
      ],
      [{ spotId: ID.spotHypocenter, description: '修学旅行の事前学習で調べてきたことを、生徒の方から話してくれました。' }],
      [
        { spotId: ID.spotIntroduction, description: '自己紹介で被爆三世だと話すと、生徒たちの表情が変わりました。' },
        { placeNote: '平和公園の階段（エスカレーター横）', description: '階段を上りながら、原爆で家族を亡くした祖母の話を聞かせてほしいと頼まれました。' },
      ],
    ],
    1: [
      [{ placeNote: '浦上天主堂', description: '被爆したマリア像の話で、研修担当の方が涙ぐんでいました。' }],
      [{ placeNote: '浦上天主堂', description: '崩れた鐘楼の前で、なぜ残さなかったのかと質問され、議論になりました。' }],
      [{ placeNote: '浦上天主堂', description: '社員の方々が熱心にメモを取っていて、説明にも熱が入りました。' }],
      [{ placeNote: '浦上天主堂', description: '頭部の焼けた石像を見て、しばらく誰も話しませんでした。' }],
      [{ placeNote: '浦上天主堂', description: 'キリシタンの歴史から話すと、原爆の話がより重く伝わったようでした。' }],
    ],
    2: [
      [
        { spotId: ID.spotGroundLevel, description: '地層の展示で、ガラス越しにのぞき込む生徒の列ができました。' },
        { spotId: ID.spotPeaceStatue, description: '式典の話をすると、テレビで見たことがあると盛り上がりました。' },
      ],
      [{ spotId: ID.spotFountainOfPeace, description: '「水をください」という言葉の重さを、生徒が自分の言葉で言い直してくれました。' }],
      [{ spotId: ID.spotMatsuyamaShelter, description: '中に入れないことを残念がる生徒に、当時の様子を写真で見せました。' }],
      [
        { spotId: ID.spotHypocenter, description: '碑の周りで黙とうをしようと生徒から提案がありました。' },
        { spotId: ID.spotClosing, description: '引率の先生から、帰ってから壁新聞にまとめると聞きました。' },
      ],
      [{ spotId: ID.spotPeaceStatue, description: '像の前で集合写真を撮る前に、一度みんなで手を合わせました。' }],
    ],
    3: [
      [{ placeNote: 'VOICE', description: '証言映像のあと、中学生が「もっと早く知りたかった」と話していました。' }],
      [{ placeNote: 'VOICE', description: '自分と同じ年の子の体験談に、みんな真剣な顔で聞き入っていました。' }],
      [{ placeNote: 'VOICE', description: '感想を書く時間に、鉛筆がなかなか止まらない生徒が多かったです。' }],
      [{ placeNote: 'VOICE', description: '休憩中に一人の生徒が、祖父も長崎の出身だと話しに来てくれました。' }],
      [{ placeNote: 'VOICE', description: '質問の時間が足りないほど手が挙がりました。' }],
    ],
    4: [
      [{ placeNote: '原爆資料館', description: '11時2分で止まった時計の前で、足を止める生徒が多かったです。' }],
      [{ placeNote: '原爆資料館', description: '溶けたガラス瓶を見て、熱線の温度を質問されました。' }],
      [{ placeNote: '原爆資料館', description: '写真の展示の前で気分が悪くなった生徒がいて、少し休んでもらいました。' }],
      [{ placeNote: '原爆資料館', description: '核兵器の現状のコーナーで、「今もこんなにあるの」と驚いていました。' }],
      [{ placeNote: '原爆資料館', description: '被爆者の方の写真と名前を一人ずつ読み上げる生徒がいました。' }],
    ],
  }
  // Only some buddies write down a question they could not answer.
  const TIER1_OPEN_QUESTIONS: Record<number, (string | null)[]> = {
    0: [null, '地層の展示はいつ発掘されたのかと聞かれ、答えられませんでした。', null, null, '祖父母が被爆者でない人がガイドをする理由を聞かれました。'],
    1: [null, '鐘楼を保存しなかった経緯を、正確に説明できませんでした。', null, null, null],
    2: [null, null, '防空壕に当時何人避難していたか、数字が出てきませんでした。', null, null],
    3: [null, null, null, null, null],
    4: [null, '熱線の温度が何度だったか、正確な数字を答えられませんでした。', null, null, null],
  }
  const tier1ReflectionCount = new Map<number, number>()

  const CATEGORY_CYCLE = [
    CancellationCategory.personal, CancellationCategory.work, CancellationCategory.health,
    CancellationCategory.other, CancellationCategory.emergency,
  ]
  const UNAVOIDABLE_CYCLE: (boolean | null)[] = [true, false, null]

  for (const arch of BUDDY_ARCHETYPES.filter((a) => a.participation === 'core')) {
    const buddyId = r(arch.index)
    const buddyTier = ROSTER[arch.index].tier
    if (!buddyId || !buddyTier) continue

    for (const tour of TIER1_TOURS) {
      const slot = (arch.index + tour.i) % 6
      if (slot === 5) continue // sits this one out — not every tour needs every buddy

      const status = slot === 4 ? BookingStatus.declined : BookingStatus.confirmed
      const row = await prisma.booking.upsert({
        where: { buddyId_sessionId: { buddyId, sessionId: tour.sessionId } },
        update: {},
        create: { buddyId, tourId: tour.id, sessionId: tour.sessionId, status, buddyTier },
      })

      if (status === BookingStatus.declined) {
        // Well before the deadline: the formulaic cancellations are never
        // sudden. The rare late/no-show cases are the hand-picked
        // exceptions in the section above, not these.
        await prisma.cancellationReason.upsert({
          where: { bookingId: row.id },
          update: {},
          create: {
            bookingId: row.id,
            category: CATEGORY_CYCLE[(arch.index + tour.i) % CATEGORY_CYCLE.length],
            unavoidable: UNAVOIDABLE_CYCLE[(arch.index + tour.i) % UNAVOIDABLE_CYCLE.length],
            recordedBy: adminUser.id,
            createdAt: daysFromNow(-(tour.deadlineDaysAgo + 3)),
          },
        })
        continue
      }

      // Attended — most get evaluated; a rotating share also write a
      // reflection, so reflection rate stays under 100% like it would in
      // practice.
      if ((arch.index + tour.i) % 4 !== 0) {
        await prisma.adminEvaluation.upsert({
          where: { buddyId_tourId_createdBy: { buddyId, tourId: tour.id, createdBy: adminUser.id } },
          update: {},
          create: { buddyId, tourId: tour.id, createdBy: adminUser.id, ...bandScores(arch.adminView, tour.i) },
        })
      }
      if ((arch.index + tour.i) % 3 === 0) {
        const template = reflectionTemplate(arch.selfView, tour.i)
        const nth = tier1ReflectionCount.get(tour.i) ?? 0
        tier1ReflectionCount.set(tour.i, nth + 1)
        const moments = TIER1_MOMENTS[tour.i][nth] ?? []
        await prisma.tourReflection.upsert({
          where: { buddyId_sessionId: { buddyId, sessionId: tour.sessionId } },
          update: {},
          create: {
            buddyId,
            sessionId: tour.sessionId,
            didWell: template.didWell,
            couldImprove: template.couldImprove,
            openQuestions: TIER1_OPEN_QUESTIONS[tour.i][nth] ?? null,
            moments: { create: moments.map((moment, position) => ({ position, ...moment })) },
          },
        })
      }
    }

    // A holistic, not-tour-specific rating — same band as their per-tour
    // scores, since one admin's overall view of a buddy they see often
    // tends to track their per-tour scores, unlike the self-view axis above.
    await prisma.adminProfileEvaluation.upsert({
      where: { buddyId_createdBy: { buddyId, createdBy: adminUser.id } },
      update: {},
      create: { buddyId, createdBy: adminUser.id, ...bandScores(arch.adminView, arch.index) },
    })
  }

  // Occasional buddies: exactly one attended tour each, their "a few per
  // year" — half also get evaluated, so it's not all-or-nothing.
  for (const arch of BUDDY_ARCHETYPES.filter((a) => a.participation === 'occasional')) {
    const buddyId = r(arch.index)
    const buddyTier = ROSTER[arch.index].tier
    if (!buddyId || !buddyTier) continue

    const tour = TIER1_TOURS[arch.index % TIER1_TOURS.length]
    await prisma.booking.upsert({
      where: { buddyId_sessionId: { buddyId, sessionId: tour.sessionId } },
      update: {},
      create: { buddyId, tourId: tour.id, sessionId: tour.sessionId, status: BookingStatus.confirmed, buddyTier },
    })
    if (arch.index % 2 === 0) {
      await prisma.adminEvaluation.upsert({
        where: { buddyId_tourId_createdBy: { buddyId, tourId: tour.id, createdBy: adminUser.id } },
        update: {},
        create: { buddyId, tourId: tour.id, createdBy: adminUser.id, ...bandScores(arch.adminView, tour.i) },
      })
    }
  }

  // ── Existing users ("me") ────────────────────────────────────
  // Every user who signed in for real — a local developer, or the PLAB members
  // on staging, where the seed accounts cannot log in (Google sign-in only).
  // Signing up creates a pending buddy profile; an admin can be a buddy too, so
  // each one is made an active junior with bookings to see the buddy side.
  // Status and tier are only filled in where still unset, so a real edit stays.
  const existingUsers = await prisma.user.findMany({
    where: { firebaseUid: { notIn: FIREBASE_UIDS } },
    include: { buddyProfile: true, adminProfile: true },
  })

  for (const user of existingUsers) {
    const isAdmin = user.role === UserRole.admin || user.role === UserRole.super_admin
    const name = user.adminProfile?.name ?? user.email.split('@')[0]
    // Only active and suspended buddies carry a tier (see ROSTER).
    const status = !user.buddyProfile || user.buddyProfile.status === BuddyStatus.pending
      ? BuddyStatus.active
      : user.buddyProfile.status
    const tiered = status === BuddyStatus.active || status === BuddyStatus.suspended
    const profile = user.buddyProfile
      ? await prisma.buddyProfile.update({
          where: { id: user.buddyProfile.id },
          data: {
            status,
            tier: tiered ? (user.buddyProfile.tier ?? BuddyTier.junior) : user.buddyProfile.tier,
            ...(isAdmin && { memberType: MemberType.plab_member }),
          },
        })
      : await prisma.buddyProfile.create({
          data: {
            userId: user.id,
            status: BuddyStatus.active,
            tier: BuddyTier.junior,
            memberType: isAdmin ? MemberType.plab_member : MemberType.buddy,
            displayName: name,
            realName: name,
            languages: ['japanese'],
            skills: [],
          },
        })
    const myBookings = [
      { tourId: ID.tourPast,    sessionId: ID.sessionPast },
      { tourId: ID.tourPeace1,  sessionId: ID.sessionPeace1 },
      { tourId: ID.tourPeace2,  sessionId: ID.sessionPeace2 },
      { tourId: ID.tourMidterm, sessionId: ID.sessionMidterm },
    ]
    for (const booking of myBookings) {
      await prisma.booking.upsert({
        where: { buddyId_sessionId: { buddyId: profile.id, sessionId: booking.sessionId } },
        update: {},
        create: { ...booking, buddyId: profile.id, status: BookingStatus.confirmed, buddyTier: profile.tier ?? BuddyTier.junior },
      })
    }
    // No booking on tourPeace3 or tourOpen → Apply button shows there.
    // Both sessions do carry roster bookings, with pool seats still free.
    console.log(`  既存ユーザー: ${user.email} → ${profile.status}/${profile.tier}/${profile.memberType}、ブッキング追加済み`)
  }

  console.log('シード完了')
  console.log(`  ログイン: ${adminAccount.email}${buddyAccounts.length > 0 ? ' / ' + buddyAccounts.map((u: any) => u.email).join(' / ') : ''}${traineeAccounts.length > 0 ? ' / ' + traineeAccounts.map((u: any) => u.email).join(' / ') + ' (trainee)' : ''}`)
  console.log('  合成admin2: admin2@seed.local (ログイン不可 — マルチPLABメンバー評価デモ用)')
  console.log('  ツアー: 平和公園 4件（締切済み・中期・遠日程・下書き）')
  console.log('  peace-001: 参加中(buddy0) + キャンセル済み+理由あり(buddy1)')
  console.log('  peace-003: 参加済み(buddy0=junior) + キャンセル待ち(buddy1=star)')
  console.log('  tourOpen / tourPeace3: 動的バディ(me)が応募ボタンを確認できるツアー')
  console.log(`  合成ロスター: ${ROSTER.length}名 (@seed.local — エミュレーターでログイン可)`)
  console.log('  追加ツアー: 完了ツアー3件（コミュニティ/その他グループ種別、浦上・原爆資料館・VOICE — バディ統計ページ確認用 #253）')
  console.log('  ロスター実績: アクティブ20名中15名が常連（直近5件のツアーの大半に参加）、5名は稀（生涯1件）。')
  console.log('  自己評価とPLABメンバー評価は独立: 自己評価が厳しくてもPLABメンバー評価が高い者、その逆もいる。')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
