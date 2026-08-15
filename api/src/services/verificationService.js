/**
 * Profile verification: camera-only selfie submitted by the user, reviewed
 * by an admin, badge granted on approval. Review is human today; an
 * automated face-match can replace the manual step server-side later
 * without any mobile change.
 */

const { getPrismaClient } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

const prisma = getPrismaClient();

const submitVerification = async (userId, photoUrl) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { verificationStatus: true },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }
  if (user.verificationStatus === 'PENDING') {
    throw new AppError('Your verification selfie is already in review', 400);
  }
  if (user.verificationStatus === 'APPROVED') {
    throw new AppError('Your profile is already verified', 400);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      verificationStatus: 'PENDING',
      verificationPhotoUrl: photoUrl,
      verificationSubmittedAt: new Date(),
      verificationReviewedAt: null,
    },
    select: {
      verificationStatus: true,
      verificationSubmittedAt: true,
    },
  });

  return updated;
};

module.exports = { submitVerification };
