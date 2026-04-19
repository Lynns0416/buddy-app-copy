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
  await prisma.booking.deleteMany()
  await prisma.tour.deleteMany()
  await prisma.group.deleteMany()
  await prisma.buddyProfile.deleteMany()
  await prisma.user.deleteMany()

  await prisma.user.create({
    data: {
      firebaseUid: 'seed-admin-001',
      email: 'admin@peacebuddies.dev',
      role: UserRole.admin,
    },
  })

  const buddy1User = await prisma.user.create({
    data: {
      firebaseUid: 'seed-buddy-001',
      email: 'hana@peacebuddies.dev',
      role: UserRole.buddy,
      buddyProfile: {
        create: {
          status: BuddyStatus.active,
          tier: BuddyTier.junior,
          displayName: '田中 花',
          realName: '田中 花奈',
          bio: '日本の文化や歴史を訪問者に伝えることに情熱を持っています。',
          languages: ['ja', 'en'],
          skills: ['歴史', '食文化', '伝統芸能'],
          availability: '週末希望',
        },
      },
    },
    include: { buddyProfile: true },
  })

  const buddy2User = await prisma.user.create({
    data: {
      firebaseUid: 'seed-buddy-002',
      email: 'kenji@peacebuddies.dev',
      role: UserRole.buddy,
      buddyProfile: {
        create: {
          status: BuddyStatus.active,
          tier: BuddyTier.mid,
          displayName: '松田 健二',
          realName: '松田 健二',
          languages: ['ja', 'en', 'zh'],
          skills: ['テクノロジー', '建築', 'ポップカルチャー'],
          availability: '柔軟対応可',
        },
      },
    },
    include: { buddyProfile: true },
  })

  const buddy1 = buddy1User.buddyProfile!
  const buddy2 = buddy2User.buddyProfile!

  const school = await prisma.group.create({
    data: {
      name: 'さくら国際高等学校',
      type: GroupType.school,
      contactName: '陳 先生',
      contactEmail: 'chen@sakura-intl.edu',
    },
  })

  const company = await prisma.group.create({
    data: {
      name: 'テックグローバル株式会社',
      type: GroupType.company,
      contactName: '朴 様',
      contactEmail: 'park@techglobal.example',
    },
  })

  // Upcoming in 3 days — urgent, buddy1 confirmed
  const tourUrgent = await prisma.tour.create({
    data: {
      groupId: school.id,
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

  // Upcoming in 14 days — buddy1 confirmed, buddy2 maybe
  const tourMidterm = await prisma.tour.create({
    data: {
      groupId: company.id,
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

  // Upcoming in 30 days — open, no bookings yet
  await prisma.tour.create({
    data: {
      groupId: school.id,
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

  // Past completed — buddy1 confirmed
  const tourPast = await prisma.tour.create({
    data: {
      groupId: company.id,
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

  // Draft — not visible to buddies
  await prisma.tour.create({
    data: {
      groupId: school.id,
      status: TourStatus.draft,
      tourDate: daysFromNow(45),
      meetingTime: timeOnly(9),
      location: '未定',
      capacity: 4,
      cancellationDeadline: daysFromNow(40),
      notificationOffsets: [],
    },
  })

  // Cancelled — buddy2 had confirmed
  const tourCancelled = await prisma.tour.create({
    data: {
      groupId: company.id,
      status: TourStatus.cancelled,
      tourDate: daysFromNow(7),
      meetingTime: timeOnly(11),
      location: '新宿御苑',
      capacity: 3,
      cancellationDeadline: daysFromNow(3),
      notificationOffsets: [],
    },
  })

  await prisma.booking.createMany({
    data: [
      { buddyId: buddy1.id, tourId: tourUrgent.id, status: BookingStatus.confirmed },
      { buddyId: buddy1.id, tourId: tourMidterm.id, status: BookingStatus.confirmed },
      { buddyId: buddy2.id, tourId: tourMidterm.id, status: BookingStatus.maybe },
      { buddyId: buddy1.id, tourId: tourPast.id, status: BookingStatus.confirmed },
      { buddyId: buddy2.id, tourId: tourCancelled.id, status: BookingStatus.confirmed },
    ],
  })

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
