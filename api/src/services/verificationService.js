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
  const submittedAt = new Date();

  // Atomic: the transition only applies from NONE/REJECTED, so a submit
  // racing an admin review can never demote an APPROVED account back to
  // PENDING or swap the selfie out from under a reviewer
  const result = await prisma.user.updateMany({
    where: { id: userId, verificationStatus: { in: ['NONE', 'REJECTED'] } },
    data: {
      verificationStatus: 'PENDING',
      verificationPhotoUrl: photoUrl,
      verificationSubmittedAt: submittedAt,
      verificationReviewedAt: null,
    },
  });

  if (result.count === 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { verificationStatus: true },
    });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (user.verificationStatus === 'APPROVED') {
      throw new AppError('Your profile is already verified', 400);
    }
    throw new AppError('Your verification selfie is already in review', 400);
  }

  return { verificationStatus: 'PENDING', verificationSubmittedAt: submittedAt };
};

module.exports = { submitVerification };
