/*
 * SAMPLE catalogue for tests and the portal's demo mode.
 * Names follow fees already used in Waka Campa's GHL fields; every amount,
 * location detail and rate here is made up and must be replaced by the seed
 * from RCM / the real price list.
 */
const catalogue = {
  settings: { timezone: 'Pacific/Auckland', currencyName: 'NZD', currencySymbol: '$', taxName: 'GST', taxRate: 0.15, taxInclusive: true, dayCounting: '24h', graceMinutes: 59, turnaroundHours: 0, limitedThreshold: 1 },
  locations: [
    { id: 1, name: 'Auckland', code: 'AKL', address: '1 Sample Rd, Auckland', isDefault: true, minBookingDays: 3, noticeDays: 1, quoteValidDays: 7, officeOpeningTime: '09:00', officeClosingTime: '16:30', afterHoursAccepted: false, unattendedDropoffAccepted: true, unattendedDropoffFeeId: 908, minimumAge: 21 },
    { id: 2, name: 'Christchurch', code: 'CHC', address: '2 Sample St, Christchurch', minBookingDays: 3, noticeDays: 1, quoteValidDays: 7, officeOpeningTime: '09:00', officeClosingTime: '16:30', minimumAge: 21 },
    { id: 3, name: 'Queenstown', code: 'ZQN', address: '3 Sample Ave, Queenstown', minBookingDays: 5, noticeDays: 2, quoteValidDays: 7, officeOpeningTime: '10:00', officeClosingTime: '15:00', minimumAge: 21 }
  ],
  officeHours: [
    { locationId: 1, dayOfWeek: 1, closed: true },
    { locationId: 2, dayOfWeek: 1, openingTime: '10:00', closingTime: '14:00' }
  ],
  holidays: [
    { id: 1, locationId: 0, startDate: '2026-12-25', endDate: '2026-12-25', type: 'B', name: 'Christmas Day' }
  ],
  categoryTypes: [{ id: 10, name: 'Campervan', displayOrder: 1 }],
  categories: [
    { id: 101, typeId: 10, name: '2 Berth Hi-Top', sipp: 'IVMR', adults: 2, children: 0, largeCases: 2, smallCases: 1, minAge: 21, maxAge: 80, minDays: 3, units: 4, imageUrl: '' },
    { id: 102, typeId: 10, name: '4 Berth Family', sipp: 'FVMR', adults: 4, children: 2, largeCases: 3, smallCases: 2, minAge: 21, maxAge: 80, minDays: 5, units: 2, imageUrl: '' }
  ],
  driverAges: [{ id: 1, driverAge: 21 }, { id: 2, driverAge: 25, isDefault: true }, { id: 3, driverAge: 81 }],
  rates: [
    { categoryId: 101, season: 'Shoulder', startDate: '2026-10-01', endDate: '2026-11-30', period: 'day', minDays: 3, maxDays: 9, rate: 120 },
    { categoryId: 101, season: 'Shoulder', startDate: '2026-10-01', endDate: '2026-11-30', period: 'day', minDays: 10, rate: 105 },
    { categoryId: 101, season: 'Peak', startDate: '2026-12-01', endDate: '2027-02-28', period: 'day', minDays: 3, rate: 180, discountType: 'percentage', discountRate: 10 },
    { categoryId: 101, season: 'Shoulder weekly', startDate: '2026-10-01', endDate: '2026-11-30', period: 'week', minDays: 7, rate: 700 },
    { categoryId: 102, season: 'Shoulder', startDate: '2026-10-01', endDate: '2026-11-30', period: 'day', minDays: 5, rate: 170 },
    { categoryId: 102, season: 'Peak', startDate: '2026-12-01', endDate: '2027-02-28', period: 'day', minDays: 5, rate: 240 }
  ],
  fees: [
    { id: 901, kind: 'mandatory', name: 'Handling fee', type: 'Fixed', amount: 45 },
    { id: 902, kind: 'oneway', name: 'One way rental', type: 'Fixed', amount: 250 },
    { id: 903, kind: 'mandatory', name: 'Queenstown premium location', type: 'Fixed', amount: 75, locationIds: [3] },
    { id: 904, kind: 'optional', name: 'Booster seat', type: 'Daily', amount: 8, maxPrice: 80, qtyApply: true, maxQty: 3, payAgency: true, displayOrder: 1 },
    { id: 905, kind: 'optional', name: 'Forward facing seat', type: 'Daily', amount: 10, maxPrice: 100, qtyApply: true, maxQty: 3, displayOrder: 2 },
    { id: 906, kind: 'optional', name: 'Snow chains', type: 'Fixed', amount: 60, displayOrder: 3 },
    { id: 907, kind: 'optional', name: 'Card processing fee', type: 'Percentage', amount: 2, percentOnTotal: true, displayOrder: 9 },
    { id: 908, kind: 'unattended', name: 'Unattended drop-off', type: 'Fixed', amount: 50 },
    { id: 911, kind: 'insurance', name: 'Risk Taker', type: 'Daily', amount: 0, excessAmount: 4000, isDefault: true },
    { id: 912, kind: 'insurance', name: 'Peace of Mind', type: 'Daily', amount: 35, maxPrice: 700, excessAmount: 0, payAgency: true },
    { id: 921, kind: 'km', name: 'Unlimited kilometres', type: 'Daily', amount: 0, isDefault: true }
  ],
  cancelReasons: [{ id: 1, reason: 'Customer changed plans' }, { id: 2, reason: 'Booked elsewhere' }, { id: 3, reason: 'Duplicate booking' }],
  countries: [{ id: 1, name: 'New Zealand', isDefault: true }, { id: 2, name: 'Australia' }, { id: 3, name: 'Germany' }],
  doNotRent: [{ email: 'blocked@example.com' }]
};

const agency = { id: 'co_1', name: 'Sample Travel Ltd', agentCode: 'SAMPLE01', commissionPct: 20, commissionOnFees: true, canCancel: true, allowCollected: true };

module.exports = { catalogue, agency };
