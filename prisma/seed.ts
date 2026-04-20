import {
  PrismaClient,
  UserRole,
  BuddyStatus,
  BuddyTier,
  GroupType,
  TourStatus,
  BookingStatus,
} from '@prisma/client'

const prisma = new PrismaClient()

// Fixed IDs so re-running the seed is additive (upsert skips existing rows)
const ID = {
  adminUser:    'seed-user-admin-001',
  buddy1User:   'seed-user-buddy-001',
  buddy2User:   'seed-user-buddy-002',
  buddy1:       'seed-profile-001',
  buddy2:       'seed-profile-002',
  school:       'seed-group-001',
  company:      'seed-group-002',
  tourUrgent:   'seed-tour-001',
  tourMidterm:  'seed-tour-002',
  tourOpen:     'seed-tour-003',
  tourPast:     'seed-tour-004',
  tourDraft:    'seed-tour-005',
  tourCancelled:'seed-tour-006',
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
  // Users
  await prisma.user.upsert({
    where: { id: ID.adminUser },
    update: {},
    create: {
      id: ID.adminUser,
      firebaseUid: 'seed-admin-001',
      email: 'admin@peacebuddies.dev',
      role: UserRole.admin,
    },
  })

  await prisma.user.upsert({
    where: { id: ID.buddy1User },
    update: {},
    create: {
      id: ID.buddy1User,
      firebaseUid: 'seed-buddy-001',
      email: 'hana@peacebuddies.dev',
      role: UserRole.buddy,
    },
  })

  await prisma.user.upsert({
    where: { id: ID.buddy2User },
    update: {},
    create: {
      id: ID.buddy2User,
      firebaseUid: 'seed-buddy-002',
      email: 'kenji@peacebuddies.dev',
      role: UserRole.buddy,
    },
  })

  // Buddy profiles
  await prisma.buddyProfile.upsert({
    where: { id: ID.buddy1 },
    update: {},
    create: {
      id: ID.buddy1,
      userId: ID.buddy1User,
      status: BuddyStatus.active,
      tier: BuddyTier.junior,
      displayName: '田中 花',
      realName: '田中 花奈',
      bio: '日本の文化や歴史を訪問者に伝えることに情熱を持っています。',
      languages: ['ja', 'en'],
      skills: ['歴史', '食文化', '伝統芸能'],
      availability: '週末希望',
    },
  })

  await prisma.buddyProfile.upsert({
    where: { id: ID.buddy2 },
    update: {},
    create: {
      id: ID.buddy2,
      userId: ID.buddy2User,
      status: BuddyStatus.active,
      tier: BuddyTier.mid,
      displayName: '松田 健二',
      realName: '松田 健二',
      languages: ['ja', 'en', 'zh'],
      skills: ['テクノロジー', '建築', 'ポップカルチャー'],
      availability: '柔軟対応可',
    },
  })

  // Groups
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

  // Tours
  await prisma.tour.upsert({
    where: { id: ID.tourUrgent },
    update: {},
    create: {
      id: ID.tourUrgent,
      groupId: ID.school,
      status: TourStatus.published,
      tourDate: daysFromNow(3),
      meetingTime: timeOnly(9),
      location: '浅草・浅草寺',
      capacity: 2,
      description: '高校生15名を対象とした浅草寺の朝の見学ツアーです。',
      cancellationDeadline: daysFromNow(1),
      notificationOffsets: [7, 1],
    },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourMidterm },
    update: {},
    create: {
      id: ID.tourMidterm,
      groupId: ID.company,
      status: TourStatus.published,
      tourDate: daysFromNow(14),
      meetingTime: timeOnly(13, 30),
      location: '渋谷・原宿',
      capacity: 4,
      description: '企業チーム向けの午後の文化体験ツアーです。',
      cancellationDeadline: daysFromNow(10),
      maybeDeadline: daysFromNow(5),
      notificationOffsets: [14, 3],
    },
  })

  await prisma.tour.upsert({
    where: { id: ID.tourOpen },
    update: {},
    create: {
      id: ID.tourOpen,
      groupId: ID.school,
      status: TourStatus.published,
      tourDate: daysFromNow(30),
      meetingTime: timeOnly(10),
      location: '上野公園・博物館エリア',
      capacity: 3,
      description: '中学生向けの上野ミュージアム巡り一日ツアーです。',
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
      location: '秋葉原',
      capacity: 5,
      description: 'テクノロジーとポップカルチャーを巡るウォーキングツアーです。',
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
      location: '新宿御苑',
      capacity: 3,
      cancellationDeadline: daysFromNow(3),
      notificationOffsets: [],
    },
  })

  // Bookings — @@unique([buddyId, tourId]) allows upsert on compound key
  const bookings = [
    { buddyId: ID.buddy1, tourId: ID.tourUrgent,   status: BookingStatus.confirmed },
    { buddyId: ID.buddy1, tourId: ID.tourMidterm,  status: BookingStatus.confirmed },
    { buddyId: ID.buddy2, tourId: ID.tourMidterm,  status: BookingStatus.maybe },
    { buddyId: ID.buddy1, tourId: ID.tourPast,     status: BookingStatus.confirmed },
    { buddyId: ID.buddy2, tourId: ID.tourCancelled,status: BookingStatus.confirmed },
  ]

  for (const b of bookings) {
    await prisma.booking.upsert({
      where: { buddyId_tourId: { buddyId: b.buddyId, tourId: b.tourId } },
      update: {},
      create: b,
    })
  }

  console.log('シード完了')
  console.log('  バディ: hana@peacebuddies.dev, kenji@peacebuddies.dev')
  console.log('  ツアー: 公開4件（緊急・中期・空き・キャンセル済）、完了1件、下書き1件')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
