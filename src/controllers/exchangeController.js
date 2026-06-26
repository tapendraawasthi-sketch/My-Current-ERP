export const sync = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Sync started' });
  } catch (error) {
    next(error);
  }
};

export const getLogs = async (req, res, next) => {
  try {
    res.json({ success: true, data: [] });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    res.json({ success: true, message: 'Exchange settings updated' });
  } catch (error) {
    next(error);
  }
};
