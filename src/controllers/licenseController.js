export const getStatus = async (req, res, next) => {
  try {
    res.json({ success: true, status: 'active', plan: 'pro', expiry: '2027-12-31' });
  } catch (error) {
    next(error);
  }
};

export const activate = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'License activated' });
  } catch (error) {
    next(error);
  }
};
