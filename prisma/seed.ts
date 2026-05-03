import {
  PrismaClient,
  UserRole,
  BuddyStatus,
  BuddyTier,
  GroupType,
  TourStatus,
  BookingStatus,
  CancellationCategory,
} from '@prisma/client'

const prisma = new PrismaClient()

// Load all Firebase accounts from emulator export
const authExport = require('../.firebase/emulators/auth_export/accounts.json')
const adminAccounts = authExport.users.filter((u: any) =>
  u.email.toLowerCase().includes('admin') || u.displayName.toLowerCase().includes('admin')
)
const adminAccount = adminAccounts[0]
const buddyAccounts = authExport.users.filter((u: any) => !adminAccounts.includes(u))
// Synthetic second admin (always seeded, cannot log in — display only for multi-admin eval demo)
const SEED_ADMIN2_UID = 'seed-admin2-00000000000000000000000'
const FIREBASE_UIDS = [...authExport.users.map((u: any) => u.localId), SEED_ADMIN2_UID]

// Fixed IDs for groups, tours (never auto-created via login)
const ID = {
  school:        '00000000-0000-0000-0000-000000000001',
  company:       '00000000-0000-0000-0000-000000000002',
  hs1:           '00000000-0000-0000-0000-000000000003',
  hs2:           '00000000-0000-0000-0000-000000000004',
  jhs1:          '00000000-0000-0000-0000-000000000005',
  jhs2:          '00000000-0000-0000-0000-000000000006',
  tourUrgent:    '00000000-0000-0000-0001-000000000001',
  tourMidterm:   '00000000-0000-0000-0001-000000000002',
  tourOpen:      '00000000-0000-0000-0001-000000000003',
  tourPast:      '00000000-0000-0000-0001-000000000004',
  tourDraft:     '00000000-0000-0000-0001-000000000005',
  tourCancelled: '00000000-0000-0000-0001-000000000006',
  tourPeace1:    '00000000-0000-0000-0001-000000000007',
  tourPeace2:    '00000000-0000-0000-0001-000000000008',
  tourPeace3:    '00000000-0000-0000-0001-000000000009',
  tourPeace4:    '00000000-0000-0000-0001-000000000010',
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
  const buddies: string[] = []
  for (const account of buddyAccounts) {
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
        languages: ['japanese', 'english'],
        skills: [],
      },
      create: {
        userId: user.id,
        status: BuddyStatus.active,
        displayName: account.displayName ?? account.email.split('@')[0],
        realName: account.displayName ?? '',
        languages: ['japanese', 'english'],
        skills: [],
      },
    })

    buddies.push(profile.id)
  }

  // Helper: cycle through buddy IDs for booking distribution
  const b = (i: number) => buddies.length > 0 ? buddies[i % buddies.length] : null

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
      meetingTime: timeOnly(9),
      location: '平和公園',
      capacity: 10,
      participantCount: 90,
      description: '高校生90名を対象としたツアーです。',
      cancellationDeadline: daysFromNow(1),
      notificationOffsets: [7, 1],
    },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourMidterm },
    update: { bookingOpen: true },
    create: {
      id: ID.tourMidterm,
      groupId: ID.company,
      status: TourStatus.published,
      tourDate: daysFromNow(14),
      meetingTime: timeOnly(13, 30),
      location: '平和公園',
      capacity: 3,
      participantCount: 12,
      bookingOpen: true,
      description: '企業チーム向けのツアーです。',
      cancellationDeadline: daysFromNow(10),
      maybeDeadline: daysFromNow(5),
      notificationOffsets: [14, 3],
    },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourOpen },
    update: { bookingOpen: true },
    create: {
      id: ID.tourOpen,
      groupId: ID.school,
      status: TourStatus.published,
      tourDate: daysFromNow(30),
      meetingTime: timeOnly(10),
      location: '平和公園',
      capacity: 8,
      participantCount: 60,
      bookingOpen: true,
      description: '中学生向けのツアーです。',
      cancellationDeadline: daysFromNow(24),
      notificationOffsets: [14, 7],
    },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourPast },
    update: {},
    create: {
      id: ID.tourPast,
      groupId: ID.company,
      status: TourStatus.completed,
      tourDate: daysFromNow(-30),
      meetingTime: timeOnly(14),
      location: '平和公園',
      capacity: 3,
      participantCount: 12,
      description: '企業向けツアーです',
      cancellationDeadline: daysFromNow(-35),
      notificationOffsets: [],
    },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourDraft },
    update: {},
    create: {
      id: ID.tourDraft,
      groupId: ID.school,
      status: TourStatus.draft,
      tourDate: daysFromNow(45),
      meetingTime: timeOnly(9),
      location: '未定',
      capacity: 4,
      participantCount: 12,
      cancellationDeadline: daysFromNow(40),
      notificationOffsets: [],
    },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourCancelled },
    update: {},
    create: {
      id: ID.tourCancelled,
      groupId: ID.company,
      status: TourStatus.cancelled,
      tourDate: daysFromNow(7),
      meetingTime: timeOnly(11),
      location: '平和公園',
      capacity: 3,
      participantCount: 20,
      cancellationDeadline: daysFromNow(3),
      notificationOffsets: [],
    },
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
      meetingTime: timeOnly(9, 30),
      location: '平和公園',
      capacity: 15,
      participantCount: 120,
      bookingOpen: false,
      description: '修学旅行生向け平和学習ツアーです。。',
      cancellationDeadline: daysFromNow(-2),
      notificationOffsets: [7, 1],
    },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourPeace2 },
    update: {},
    create: {
      id: ID.tourPeace2,
      groupId: ID.jhs1,
      status: TourStatus.published,
      tourDate: daysFromNow(14),
      meetingTime: timeOnly(10),
      location: '平和公園',
      capacity: 4,
      participantCount: 20,
      bookingOpen: true,
      description: '広島市立平和中学校の生徒を対象とした小規模ツアーです。',
      cancellationDeadline: daysFromNow(9),
      maybeDeadline: daysFromNow(5),
      notificationOffsets: [14, 3],
    },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourPeace3 },
    update: {},
    create: {
      id: ID.tourPeace3,
      groupId: ID.hs2,
      status: TourStatus.published,
      tourDate: daysFromNow(28),
      meetingTime: timeOnly(13),
      location: '平和公園',
      capacity: 12,
      participantCount: 100,
      bookingOpen: true,
      description: '福岡第一高等学校の修学旅行。',
      cancellationDeadline: daysFromNow(21),
      maybeDeadline: daysFromNow(14),
      notificationOffsets: [14, 7, 3],
    },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourPeace4 },
    update: {},
    create: {
      id: ID.tourPeace4,
      groupId: ID.jhs2,
      status: TourStatus.draft,
      tourDate: daysFromNow(50),
      meetingTime: timeOnly(9),
      location: '平和公園',
      capacity: 8,
      participantCount: 60,
      description: '松山市立南中学校の平和学習ツアー（日程調整中）。',
      cancellationDeadline: daysFromNow(44),
      notificationOffsets: [],
    },
  })

  // ── Bookings (skip if no buddies) ───────────────────────────
  if (buddies.length === 0) {
    console.log('  警告: バディがいません。ブッキングをスキップしました。')
  } else {
    // Existing bookings
    const existingBookings = [
      { buddyId: b(0)!, tourId: ID.tourUrgent,    status: BookingStatus.confirmed },
      { buddyId: b(0)!, tourId: ID.tourMidterm,   status: BookingStatus.confirmed },
      { buddyId: b(1)!, tourId: ID.tourMidterm,   status: BookingStatus.maybe },
      { buddyId: b(0)!, tourId: ID.tourPast,      status: BookingStatus.confirmed },
      { buddyId: b(1)!, tourId: ID.tourCancelled, status: BookingStatus.confirmed },
    ]
    for (const booking of existingBookings) {
      await prisma.booking.upsert({
        where: { buddyId_tourId: { buddyId: booking.buddyId, tourId: booking.tourId } },
        update: {},
        create: booking,
      })
    }

    // peace-001: confirmed + declined
    await prisma.booking.upsert({
      where: { buddyId_tourId: { buddyId: b(0)!, tourId: ID.tourPeace1 } },
      update: {},
      create: { buddyId: b(0)!, tourId: ID.tourPeace1, status: BookingStatus.confirmed },
    })

    const declinedBooking = await prisma.booking.upsert({
      where: { buddyId_tourId: { buddyId: b(1)!, tourId: ID.tourPeace1 } },
      update: {},
      create: { buddyId: b(1)!, tourId: ID.tourPeace1, status: BookingStatus.declined },
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

    // peace-002, peace-003
    const newTourBookings = [
      { buddyId: b(0)!, tourId: ID.tourPeace2, status: BookingStatus.confirmed },
      { buddyId: b(1)!, tourId: ID.tourPeace2, status: BookingStatus.maybe },
      { buddyId: b(1)!, tourId: ID.tourPeace3, status: BookingStatus.confirmed },
    ]
    for (const booking of newTourBookings) {
      await prisma.booking.upsert({
        where: { buddyId_tourId: { buddyId: booking.buddyId, tourId: booking.tourId } },
        update: {},
        create: booking,
      })
    }
  }

  // ── Evaluations (skip if no buddies) ────────────────────────
  if (buddies.length > 0) {
    // Ensure b(1) also has a confirmed booking on tourPast so TourBuddyEvalSection shows 2 buddies
    if (buddies.length > 1) {
      await prisma.booking.upsert({
        where: { buddyId_tourId: { buddyId: b(1)!, tourId: ID.tourPast } },
        update: {},
        create: { buddyId: b(1)!, tourId: ID.tourPast, status: BookingStatus.confirmed },
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

  // ── Dynamic "me" ────────────────────────────────────────────
  // Finds any non-seed user who logged in. Login once, then re-run seed.
  const dynamicUser = await prisma.user.findFirst({
    where: { firebaseUid: { notIn: FIREBASE_UIDS } },
    include: { buddyProfile: true },
  })

  if (dynamicUser?.buddyProfile) {
    const myBuddyId = dynamicUser.buddyProfile.id
    const myBookings = [
      { buddyId: myBuddyId, tourId: ID.tourPast,    status: BookingStatus.confirmed },
      { buddyId: myBuddyId, tourId: ID.tourPeace1,  status: BookingStatus.confirmed },
      { buddyId: myBuddyId, tourId: ID.tourPeace2,  status: BookingStatus.confirmed },
      { buddyId: myBuddyId, tourId: ID.tourMidterm, status: BookingStatus.confirmed },
    ]
    for (const booking of myBookings) {
      await prisma.booking.upsert({
        where: { buddyId_tourId: { buddyId: booking.buddyId, tourId: booking.tourId } },
        update: {},
        create: booking,
      })
    }
    console.log(`  動的バディ: ${dynamicUser.email} → ブッキング追加済み`)
  }

  console.log('シード完了')
  console.log(`  ログイン: ${adminAccount.email}${buddyAccounts.length > 0 ? ' / ' + buddyAccounts.map((u: any) => u.email).join(' / ') : ''}`)
  console.log('  合成admin2: admin2@seed.local (ログイン不可 — マルチ管理者評価デモ用)')
  console.log('  ツアー: 平和公園 4件（締切済み・中期・遠日程・下書き）')
  console.log('  peace-001: 参加中(buddy0) + キャンセル済み+理由あり(buddy1)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
