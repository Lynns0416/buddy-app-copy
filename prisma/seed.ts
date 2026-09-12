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

// Load all Firebase accounts from emulator export
const authExport = require('../.firebase/emulators/auth_export/accounts.json')
const adminAccounts = authExport.users.filter((u: any) =>
  u.email.toLowerCase().includes('admin') || u.displayName.toLowerCase().includes('admin')
)
const adminAccount = adminAccounts[0]
const traineeAccounts = authExport.users.filter((u: any) =>
  u.email?.toLowerCase().includes('trainee') || u.displayName?.toLowerCase().includes('trainee')
)
const buddyAccounts = authExport.users.filter(
  (u: any) => !adminAccounts.includes(u) && !traineeAccounts.includes(u)
)
// Synthetic second admin (always seeded, cannot log in — display only for multi-admin eval demo)
const SEED_ADMIN2_UID = 'seed-admin2-00000000000000000000000'

// Synthetic roster buddies (always seeded, cannot log in — display only).
// The admin roster, its filters and its sorting need more rows than the
// handful of Firebase accounts provide. These have no auth account, like
// Seed Admin 2 above: only the Firebase accounts and the dynamic "me" user
// can actually log in.
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

const rosterUid = (i: number) => `seed-buddy-${String(i + 1).padStart(2, '0')}`

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

  // ── Tours (existing) ────────────────────────────────────────
  await prisma.tour.upsert({
    where: { id: ID.tourUrgent },
    update: {},
    create: {
      id: ID.tourUrgent,
      groupId: ID.school,
      status: TourStatus.published,
      tourDate: daysFromNow(3),
      location: '平和公園',
      description: '高校生90名を対象としたツアーです。',
      cancellationDeadline: daysFromNow(1),
      notificationOffsets: [7, 1],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionUrgent },
    update: {},
    create: { id: ID.sessionUrgent, tourId: ID.tourUrgent, order: 1, meetingTime: timeOnly(9), capacity: 10, participantCount: 90 },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourMidterm },
    update: { bookingOpen: true },
    create: {
      id: ID.tourMidterm,
      groupId: ID.company,
      status: TourStatus.published,
      tourDate: daysFromNow(14),
      location: '平和公園',
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
    create: { id: ID.sessionMidterm, tourId: ID.tourMidterm, order: 1, meetingTime: timeOnly(13, 30), capacity: 3, participantCount: 12 },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourOpen },
    update: { bookingOpen: true },
    create: {
      id: ID.tourOpen,
      groupId: ID.school,
      status: TourStatus.published,
      tourDate: daysFromNow(30),
      location: '平和公園',
      bookingOpen: true,
      description: '中学生向けのツアーです。',
      cancellationDeadline: daysFromNow(24),
      notificationOffsets: [14, 7],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionOpen },
    update: {},
    create: { id: ID.sessionOpen, tourId: ID.tourOpen, order: 1, meetingTime: timeOnly(10), capacity: 8, participantCount: 60 },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionOpen2 },
    update: {},
    create: { id: ID.sessionOpen2, tourId: ID.tourOpen, order: 2, meetingTime: timeOnly(13), capacity: 5, participantCount: 60 },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourPast },
    update: {},
    create: {
      id: ID.tourPast,
      groupId: ID.company,
      status: TourStatus.completed,
      tourDate: daysFromNow(-30),
      location: '平和公園',
      description: '企業向けツアーです',
      cancellationDeadline: daysFromNow(-35),
      notificationOffsets: [],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionPast },
    update: {},
    create: { id: ID.sessionPast, tourId: ID.tourPast, order: 1, meetingTime: timeOnly(14), capacity: 3, participantCount: 12 },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourDraft },
    update: {},
    create: {
      id: ID.tourDraft,
      groupId: ID.school,
      status: TourStatus.draft,
      tourDate: daysFromNow(45),
      location: '未定',
      cancellationDeadline: daysFromNow(40),
      notificationOffsets: [],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionDraft },
    update: {},
    create: { id: ID.sessionDraft, tourId: ID.tourDraft, order: 1, meetingTime: timeOnly(9), capacity: 4, participantCount: 12 },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourCancelled },
    update: {},
    create: {
      id: ID.tourCancelled,
      groupId: ID.company,
      status: TourStatus.cancelled,
      tourDate: daysFromNow(7),
      location: '平和公園',
      cancellationDeadline: daysFromNow(3),
      notificationOffsets: [],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionCancelled },
    update: {},
    create: { id: ID.sessionCancelled, tourId: ID.tourCancelled, order: 1, meetingTime: timeOnly(11), capacity: 3, participantCount: 20 },
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
      location: '平和公園',
      bookingOpen: false,
      description: '修学旅行生向け平和学習ツアーです。。',
      cancellationDeadline: daysFromNow(-2),
      notificationOffsets: [7, 1],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionPeace1 },
    update: {},
    create: { id: ID.sessionPeace1, tourId: ID.tourPeace1, order: 1, meetingTime: timeOnly(9, 30), capacity: 15, participantCount: 120 },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourPeace2 },
    update: {},
    create: {
      id: ID.tourPeace2,
      groupId: ID.jhs1,
      status: TourStatus.published,
      tourDate: daysFromNow(14),
      location: '平和公園',
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
    create: { id: ID.sessionPeace2, tourId: ID.tourPeace2, order: 1, meetingTime: timeOnly(10), capacity: 4, participantCount: 20 },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourPeace3 },
    update: {},
    create: {
      id: ID.tourPeace3,
      groupId: ID.hs2,
      status: TourStatus.published,
      tourDate: daysFromNow(28),
      location: '平和公園',
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
    create: { id: ID.sessionPeace3, tourId: ID.tourPeace3, order: 1, meetingTime: timeOnly(13), capacity: 12, participantCount: 100 },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourPeace4 },
    update: {},
    create: {
      id: ID.tourPeace4,
      groupId: ID.jhs2,
      status: TourStatus.draft,
      tourDate: daysFromNow(50),
      location: '平和公園',
      description: '松山市立南中学校の平和学習ツアー（日程調整中）。',
      cancellationDeadline: daysFromNow(44),
      notificationOffsets: [],
    },
  })
  await prisma.tourSession.upsert({
    where: { id: ID.sessionPeace4 },
    update: {},
    create: { id: ID.sessionPeace4, tourId: ID.tourPeace4, order: 1, meetingTime: timeOnly(9), capacity: 8, participantCount: 60 },
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

    // Buddy self-evaluation for tourPast
    await prisma.selfEvaluation.upsert({
      where: { buddyId_tourId: { buddyId: b(0)!, tourId: ID.tourPast } },
      update: {},
      create: {
        buddyId: b(0)!,
        tourId: ID.tourPast,
        overallRating: 3,
        overallRatingNote: '知識の整理ができていなかった部分があります。',
        communication: 4,
        groupEngagement: 4,
        memory: 3,
        memoryNote: '資料の復習が必要だと感じました。',
        knowledge: 3,
        dedication: 4,
        dialogue: 3,
        adaptability: 4,
        confidence: 3,
        confidenceNote: '緊張してしまった場面がありました。',
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

  // ── Dynamic "me" ────────────────────────────────────────────
  // Finds any non-seed user who logged in. Login once, then re-run seed.
  const dynamicUser = await prisma.user.findFirst({
    where: { firebaseUid: { notIn: FIREBASE_UIDS } },
    include: { buddyProfile: true },
  })

  if (dynamicUser?.buddyProfile) {
    const myBuddyId = dynamicUser.buddyProfile.id
    // Set tier so the application system works (junior by default)
    await prisma.buddyProfile.update({
      where: { id: myBuddyId },
      data: { tier: BuddyTier.junior },
    })
    const myBookings = [
      { buddyId: myBuddyId, tourId: ID.tourPast,    sessionId: ID.sessionPast,    status: BookingStatus.confirmed, buddyTier: BuddyTier.junior },
      { buddyId: myBuddyId, tourId: ID.tourPeace1,  sessionId: ID.sessionPeace1,  status: BookingStatus.confirmed, buddyTier: BuddyTier.junior },
      { buddyId: myBuddyId, tourId: ID.tourPeace2,  sessionId: ID.sessionPeace2,  status: BookingStatus.confirmed, buddyTier: BuddyTier.junior },
      { buddyId: myBuddyId, tourId: ID.tourMidterm, sessionId: ID.sessionMidterm, status: BookingStatus.confirmed, buddyTier: BuddyTier.junior },
    ]
    for (const booking of myBookings) {
      await prisma.booking.upsert({
        where: { buddyId_sessionId: { buddyId: booking.buddyId, sessionId: booking.sessionId } },
        update: {},
        create: booking,
      })
    }
    // "me" has no booking on tourPeace3 or tourOpen → Apply button shows there.
    // Both sessions do carry roster bookings, with pool seats still free.
    console.log(`  動的バディ: ${dynamicUser.email} → ブッキング追加済み、tier=junior`)
  }

  console.log('シード完了')
  console.log(`  ログイン: ${adminAccount.email}${buddyAccounts.length > 0 ? ' / ' + buddyAccounts.map((u: any) => u.email).join(' / ') : ''}${traineeAccounts.length > 0 ? ' / ' + traineeAccounts.map((u: any) => u.email).join(' / ') + ' (trainee)' : ''}`)
  console.log('  合成admin2: admin2@seed.local (ログイン不可 — マルチ管理者評価デモ用)')
  console.log('  ツアー: 平和公園 4件（締切済み・中期・遠日程・下書き）')
  console.log('  peace-001: 参加中(buddy0) + キャンセル済み+理由あり(buddy1)')
  console.log('  peace-003: 参加済み(buddy0=junior) + キャンセル待ち(buddy1=star)')
  console.log('  tourOpen / tourPeace3: 動的バディ(me)が応募ボタンを確認できるツアー')
  console.log(`  合成ロスター: ${ROSTER.length}名 (@seed.local — ログイン不可、一覧・絞り込み・並び替え確認用)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
