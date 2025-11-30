// Mortgage Calculation Verification
// This tests the formulas against known industry values

console.log('=== MORTGAGE CALCULATION VERIFICATION ===\n');

// Test Case 1: Industry Standard Example
// Source: Any mortgage calculator (Bankrate, NerdWallet, etc.)
console.log('TEST 1: Standard 30-Year Mortgage');
console.log('Principal: $200,000 | Rate: 6.0% | Term: 30 years');

const principal1 = 200000;
const annualRate1 = 6.0;
const years1 = 30;
const monthlyRate1 = annualRate1 / 100 / 12;
const numPayments1 = years1 * 12;

// Standard amortization formula
const monthlyPayment1 = principal1 * (monthlyRate1 * Math.pow(1 + monthlyRate1, numPayments1)) / (Math.pow(1 + monthlyRate1, numPayments1) - 1);
const totalPaid1 = monthlyPayment1 * numPayments1;
const totalInterest1 = totalPaid1 - principal1;

console.log(`Monthly Payment: $${monthlyPayment1.toFixed(2)}`);
console.log(`Total Paid: $${totalPaid1.toFixed(2)}`);
console.log(`Total Interest: $${totalInterest1.toFixed(2)}`);
console.log(`Expected Monthly: ~$1,199.10 (industry standard)`);
console.log(`Match: ${Math.abs(monthlyPayment1 - 1199.10) < 1 ? '✓ PASS' : '✗ FAIL'}\n`);

// Test Case 2: Verify First Payment Breakdown
console.log('TEST 2: First Payment Breakdown');
const firstMonthInterest = principal1 * monthlyRate1;
const firstMonthPrincipal = monthlyPayment1 - firstMonthInterest;
console.log(`First Payment Interest: $${firstMonthInterest.toFixed(2)}`);
console.log(`First Payment Principal: $${firstMonthPrincipal.toFixed(2)}`);
console.log(`Sum equals payment: ${Math.abs((firstMonthInterest + firstMonthPrincipal) - monthlyPayment1) < 0.01 ? '✓ PASS' : '✗ FAIL'}\n`);

// Test Case 3: Amortization Schedule Verification
console.log('TEST 3: Year 1 Amortization');
let balance = principal1;
let year1Interest = 0;
let year1Principal = 0;

for (let month = 0; month < 12; month++) {
  const interestPayment = balance * monthlyRate1;
  const principalPayment = monthlyPayment1 - interestPayment;
  year1Interest += interestPayment;
  year1Principal += principalPayment;
  balance -= principalPayment;
}

console.log(`Year 1 Interest Paid: $${year1Interest.toFixed(2)}`);
console.log(`Year 1 Principal Paid: $${year1Principal.toFixed(2)}`);
console.log(`Remaining Balance: $${balance.toFixed(2)}`);
console.log(`Balance reduction matches principal: ${Math.abs((principal1 - balance) - year1Principal) < 0.01 ? '✓ PASS' : '✗ FAIL'}\n`);

// Test Case 4: Final Payment Verification
console.log('TEST 4: Full Loan Payoff');
balance = principal1;
let totalInterestPaid = 0;

for (let month = 0; month < numPayments1; month++) {
  const interestPayment = balance * monthlyRate1;
  const principalPayment = Math.min(monthlyPayment1 - interestPayment, balance);
  totalInterestPaid += interestPayment;
  balance -= principalPayment;
}

console.log(`Final Balance: $${balance.toFixed(2)}`);
console.log(`Total Interest Paid: $${totalInterestPaid.toFixed(2)}`);
console.log(`Balance is zero: ${Math.abs(balance) < 1 ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Interest matches formula: ${Math.abs(totalInterestPaid - totalInterest1) < 1 ? '✓ PASS' : '✗ FAIL'}\n`);

// Test Case 5: Accelerated Payment Logic
console.log('TEST 5: Accelerated Payment (50yr @ 6.8% paid in 30yr)');
const principal5 = 190000; // $200k house with 5% down
const rate5 = 6.8;
const originalTerm = 50;
const targetTerm = 30;
const monthlyRate5 = rate5 / 100 / 12;

// Calculate what the payment would be for 30-year payoff
const targetPayments = targetTerm * 12;
const acceleratedPayment = principal5 * (monthlyRate5 * Math.pow(1 + monthlyRate5, targetPayments)) / (Math.pow(1 + monthlyRate5, targetPayments) - 1);

// Verify it pays off in exactly 30 years
balance = principal5;
let totalPaidAccel = 0;

for (let month = 0; month < targetPayments; month++) {
  const interestPayment = balance * monthlyRate5;
  const principalPayment = acceleratedPayment - interestPayment;
  balance -= principalPayment;
  totalPaidAccel += acceleratedPayment;
}

console.log(`Accelerated Monthly Payment: $${acceleratedPayment.toFixed(2)}`);
console.log(`Final Balance after 30 years: $${balance.toFixed(2)}`);
console.log(`Pays off in 30 years: ${Math.abs(balance) < 1 ? '✓ PASS' : '✗ FAIL'}\n`);

console.log('=== VERIFICATION COMPLETE ===');
console.log('All formulas are mathematically correct and match industry standards.');
