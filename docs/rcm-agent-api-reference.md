# RCM Booking API v3.2 - method reference

Captured from RCM's own `list` and `output` methods on the Web Booking API (12 Oct 2026), plus the two Agent-API-only methods from the developer sandbox. This is what our Agent API mirrors.

Required: yes, no, or conditional (needed unless an alternative parameter is given).

## `agentbookings`

Method to get agent bookings, only available for Agent API

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `startdate` | date | conditional | Date entered, start date |
| `enddate` | date | conditional | Date entered, end date |
| `reservationno` | number | conditional | reservation number |
| `bookingstatus` | string | no | Booking status, (Optional values are: onrequest,confirmed,cancelled) |

<details><summary>Output</summary>

- `bookingstatus`: current booking status<ONREQUEST/CONFIRMED/CANCELLED><string>
- `reservationno`: reservation number - used within RCM to identify the booking, appears on customer documents<int_id>
- `reservationref`: reservation reference - used to identify the booking<string>
- `originalreservationno`: if the reservation has been updated to an allocated booking, this will have the original reservation number <int_id>
- `isquotation`: true if this is a quotation<true/false>
- `pickupdate`: pickup date <date dd/MMM/yyyy>
- `dropoffdate`: drop-off date<date dd/MMM/yyyy>
- `reservationcreateddate`: reservation created date<date dd/MMM/yyyy>
- `dropofflocationcode`: drop-off location code<string>
- `pickuplocationcode`: pickup location code<string>
- `firstname`: customer first name<string>
- `lastname`: customer last name<string>

</details>

## `booking` (alias `savebooking`)

Method to submit a booking or a quotation

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `vehiclecategorytypeid` | number | yes | vehicle category type id |
| `pickuplocationid` | number | yes | Pickup location id |
| `pickupdate` | date | yes | Pickup date |
| `pickuptime` | time | yes | pickup time |
| `dropofflocationid` | number | yes | Dropoff location id |
| `dropoffdate` | date | yes | Dropoff date |
| `dropofftime` | time | yes | Dropoff time |
| `ageid` | number | yes | Age ID, usually used for indicating the age of the youngest driver. Pass in the id of the relevant record, not the driver's age. |
| `vehiclecategoryid` | number | yes | Vehicle Category ID |
| `bookingtype` | number | yes | Booking type (1=quote, 2=booking) |
| `insuranceid` | number | yes | Insurance ID |
| `extrakmsid` | number | yes | Extra Kms ID |
| `transmission` | number | yes | Transmission preference: 0=no preference, 1=auto, 2=manual |
| `emailoption` | number | no | Email option, 0=never send email, 1=default behaviour, 2=always send email |
| `referralid` | number | no | Referral ID for Referral Booking |
| `campaigncode` | string(30) | no | Campaign code (max. length=30) |
| `agentcode` | string(20) | no | Agent code (max. length=20) |
| `agentname` | string(20) | no | Name of the agent who took this booking (max. length=20) |
| `agentemail` | string(50) | no | Agent email (max. length=50) |
| `agentrefno` | string(50) | no | Agent reference code (max. length=50) |
| `agentcollectedamount` | number | no | Amount collected by agent, to be applied as a payment to the booking. Only pass a value in if your collected amount is different than the RCM calculated value, otherwise leave this field out entirely. Do not pass in '0' unless that is your collected amount. Note: Use of this field needs to be enabled per-agent inside RCM. |
| `foundusid` | number | no | Found Us ID |
| `remark` | string(250) | no | Booking remarks by customer |
| `numbertravelling` | number | conditional | Number of people traveling |
| `flightin` | string(50) | no | Flight Number Arrival |
| `flightout` | string(50) | no | Flight Number Departure |
| `arrivalpoint` | string(80) | no | Arrival Collection Point |
| `departurepoint` | string(80) | no | Departure Return Point |
| `areaofuseid` | number | no | Area Of Use ID |
| `newsletter` | boolean | no | News letter flag: 0=no news letter, 1=sign up for news letter |
| `refno` | string(50) | no | Reference Number |
| `relocationspecialid` | number | no | Optional: Relocation Special ID as defined within the RCM System |
| `packageid` | number | no | Optional: Package ID as defined within the RCM System |
| `rateperiod_typeid` | number | no | Optional: rateperiod_typeid if not daily rates - 0:daily rate (default), 1:monthly rate, 2:weekly rate |
| `urlid` | number | no | Optional: urlid as defined in RCM to distinguish which brand should be applied |
| `customer` | json:customer | yes | Customer data like last name, driver license etc... using json string |
| `extradriver` | json:customer | no | Customer data like last name, driver license etc, for one or more additional drivers... using json string |
| `optionalfees` | json:optionalfees | no | Optional extra fees, json data containing 1:n optional extra fees eq. [{'id':1,'qty':2},..] |

<details><summary>Output</summary>

- `reservationref`: reservation reference - used to identify the booking<string>
- `reservationno`: reservation number - used within RCM to identify the booking, appears on customer documents<int_id>
- `customerid`: customer id for this booking <int_id>

</details>

## `bookinginfo`

Method to load booking info which can be used when updating customer or to create your own email for customer

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `reservationref` | string(30) | conditional | Booking reference code returned from method booking or editbooking |
| `reservationno` | number | conditional | Reservation number |
| `lastname` | string | conditional | Lastname |
| `email` | string | conditional | Email |

<details><summary>Output</summary>

- **bookinginfo**
  - `reservationref`: reservation reference - used to identify the booking<string>
  - `reservationno`: reservation number - used within RCM to identify the booking, appears on customer documents <int_id>
  - `reservationdocumentno`: reservation number with extra prefixed details for output into documents/emails etc<string>
  - `reservationstatus`: current status of the reservation <Reservation/Hired/Cancelled/Maintenance/Returned/Reservation Request><string>
  - `isonrequest`: true if this reservation is 'on request', false if confirmed. <true/false>
  - `reservationtypedescription`: description of reservation for output to customer e.g. 'Online Reservation' or 'Online Quotation'<string>
  - `reservationcreateddate`: date reservation was created<date dd/MMM/yyyy>
  - `isvehicleallocated`: true if a vehicle has been allocated to this reservation<true/false>
  - `isquotation`: true if this is a quotation rather than a booking<true/false>
  - `agreementpage`: deprecated - use agreementurl instead. 
  - `agreementurl`: full url of the rental agreement for this reservation (allocated bookings only). 
  - `quoteconversionurl`: quote conversion url - for the customer to convert the quotation into a booking, if applicable<string>
  - `quoteconversionvalidmessage`: quote conversion valid message - message about how long the quotation is valid, or quotation expiry status, if applicable<string>
  - `isvalidquotation`: for quotations - true if quotation is still valid and not expired.<true/false>
  - `driverageid`: reference to driver age record used for the booking<int_id>
  - `pickuplocationid`: location id of pickup<int_id>
  - `pickupdate`: date of pickup (pickup location-timezone)<date dd/MMM/yyyy>
  - `pickuptime`: time of pickup (pickup location-timezone)<24hour time HH:mm>
  - `pickuplocationname`: pickup location name <string>
  - `pickuplocationaddress`: pickup location address<string>
  - `arrivalpoint`: arrival point or collection point<string>
  - `flightin`: arrival flight number<string>
  - `dropofflocationid`: location id of drop-off location<int_id>
  - `dropoffdate`: date of drop-off (dropoff location-timezone)<date dd/MMM/yyyy>
  - `dropofftime`: time of drop-off (dropoff location-timezone)<24hour time HH:mm>
  - `dropofflocationname`: drop-off location name<string>
  - `dropofflocationaddress`: drop-off location address<string>
  - `departurepoint`: departure point or drop-off point<string>
  - `flightout`: flight number of departure<string>
  - `rentalsource`: rental source name<string>
  - `customerid`: customer id for this booking<int_id>
  - `customerremark`: customer notes for this booking<string>
  - `numbertravelling`: number of people travelling<string>
  - `areaofusedescription`: area of use description<string>
  - `transmission`: transmission preference<string>
  - `vehiclecategoryid`: vehicle category id<int_id>
  - `vehiclecategory`: vehicle category name<string>
  - `vehicleimage`: url to vehicle category image<string>
  - `vehicledescription1`: vehicle category description<string>
  - `vehicle_numberofadults`: number of adults this vehicle category can accommodate<int>
  - `vehicle_numberofchildren`: number of children this vehicle category can accommodate<int>
  - `vehicle_numberoflargecases`: number of large cases this vehicle category can accommodate<int>
  - `vehicle_numberofsmallcases`: number of small cases this vehicle category can accommodate<int>
  - `vehicle_id`: unique id of assigned vehicle (0 if unallocated) <int>
  - `vehicle_registrationnumber`: registration number of assigned vehicle (empty if unallocated) <string>
  - `vehicle_fleetnumber`: fleet number of assigned vehicle (empty if unallocated) <string>
  - `vehicle_deviceid`: telemax device id (if relevant)
  - `currencyname`: name of currency used for this booking e.g. AUD<string>
  - `currencysymbol`: symbol of currency used for this booking e.g. $ <string>
  - `shouldhiderates`: true if rates should not be displayed to customer[e.g. from wholesale agent emails]<true/false>
  - `shouldhideextrarates`: true if mandatory or optional/extra fees rates should not be displayed to customer [e.g. from wholesale agent emails] <true/false>
  - `shouldhideinsurancerates`: true if insurance rates should not be displayed to customer [e.g. from wholesale agent emails]<true/false>
  - `numberofdays`: number of days for booking<real>
  - `dailyrate`: daily rate for booking<money>
  - `totalcost`: total cost of the booking including all insurance/extra fees etc.<money>
  - `campaigncode`: campaign code or discount code or promo code used for this booking<string>
  - `payment`: total payment amount received from the customer for this booking<money>
  - `balancedue`: amount due from customer for the booking<money>
  - `taxname1`: name of tax applied if any<string>
  - `taxname2`: name of secondary tax applied if any<string>
  - `stampduty`: total amount of stamp duty for this booking<money>
  - `gst`: total amount of gst for this booking<money>
  - `isgstinclusive`: true if gst is included in the booking totals <true/false>
  - `fuelcost`: total fuel cost (if any) as calculated upon return of booking <money>
  - `taxname1_glcode`: general ledger code (if set) for the tax charged for the primary tax/state tax <string>
  - `taxname2_glcode`: general ledger code (if set) for the tax charged for secondary tax/gst <string>
  - `rentalrevenue_glcode`: general ledger code for the rental cost <string>
  - `fuelcost_glcode`: general ledger code for the fuel cost <string>
  - `kmcharges_glcode`: general ledger code for the kilometre/mileage cost <string>
  - `mileagedesc`: <string> e.g. kilometres/miles
  - `kmcharges_id`: id of chosen kilometre charges option<int_id>
  - `kmcharges_description`: description of the kilometre charges record for displaying, e.g. 'Unlimited kilometres, daily rate @ $12.00'<string>
  - `kmcharges_feeforeachadditionalkm`: fee charged for each additional kilometre/mile above 'numberofkmsfree' amount<money>
  - `kmcharges_additionalkmtotalamount`: fee charged for total additionals kilometre/mile above 'totalnumberofkmsfree' amount<money>
  - `kmcharges_dailyrate`: daily rate that applies for this kmcharges option<money>
  - `kmcharges_maximumprice`: maximum price for this option if set<money>
  - `kmcharges_totalfordailyrate`: total kmcharges amount for this booking where daily rate applies<money>
  - `kmcharges_totalnumberofkmsfree`: total number of kilometres/miles free for this booking<real>
  - `kmcharges_notes`: notes about this kilometre charges option <string>
  - `emailhtmlfilepart1`: email template html file for confirmation emails part 1 <string>
  - `emailhtmlfilepart2`: email template html file for confirmation emails part 2 <string>
  - `agentrefno`: agent reference number [agents only]<string>
  - `agent`: agent name [agents only] <string>
  - `agentbranch`: agent branch name [agents only]<string>
  - `agentname`: name of agent who took this booking if known [agents only]<string>
  - `agentcommission`: agent commission amount[agents only]<money>
  - `agentnetamountdue`: agent net amount due[agents only]<money>
  - `agentemail`: agent email address<string>
  - `packageid`: package identifier [package bookings only] <int_id>
  - `packagetypeid`: package type identifier [package bookings only] <int_id>
  - `packagename`: name of package [package bookings only] <string>
  - `packagedescription`: package description [package bookings only] <string>
  - `packageimages`: package images [package bookings only] <string>
  - `kmsout`: odometer at time of hire <string>
  - `kmsin`: odometer at return <string
  - `kmstravelled`: total travelled distance <int>
  - `isclosed`: true if booking has been closed <true/false>
- **customerinfo**
  - `customerid`: id of customer<int_id>
  - `firstname`: first name<string>
  - `lastname`: last name<string>
  - `dateofbirth`: date of birth<date dd/MM/yyyy>
  - `licenseno`: drivers license number<string>
  - `licenseissued`: drivers license issued from<string>
  - `licenseexpires`: drivers license expires date/string <date dd/MMM/yyyy> or <string 'lifetime'>
  - `email`: email<string>
  - `phone`: phone number<string>
  - `mobile`: mobile number<string>
  - `fulladdress`: full address<string>
  - `address`: <string>
  - `city`: <string>
  - `state`: <string>
  - `postcode`: <string>
  - `country`: <string>
  - `countryid`: reference to country id record<int_id>
  - `localaddress`: local address<string>
  - `passport`: <string>
  - `mailinglist`: true if this customer has not opted out of mailing list <true/false>
  - `loyaltycardno`: loyalty card number<string>
- **companyinfo**
  - `logo`: url to company logo image<string>
  - `companyemail`: company email<string>
  - `companyname`: company name<string>
  - `companycolour`: company colour for HTML e.g. #0080C0<string>
  - `branchaddress`: company branch address<string>
  - `branchcity`: company branch city<string>
  - `branchpostcode`: company branch postcode<string>
  - `branchphone`: company branch phone number <string>
  - `branchfax`: company branch fax<string>
  - `website`: company website<string>
  - `freephone`: company free phone/free call number<string>
- **rateinfo**
  - `season`: name of rate season, or rate description<string>
  - `numberofdays`: number of days for this rate<real>
  - `numberofhours`: number of hours for this rate (short hires)<real>
  - `dailyratebeforediscount`: daily rate before discount<money>
  - `dailyrateafterdiscount`: daily rate after discount<money>
  - `discountname`: discount name<string>
  - `discountdescription`: discount description e.g '10% discount included - August Special' <string>
  - `discountpercentagerate`: discount percentage rate, if applicable<real>
  - `discountdailyrate`: discount daily rate, if applicable<money>
  - `monthlyrate_numberofmonths`: number of months if using monthly rates<int>
  - `monthlyrate_afterdiscount`: montly rate after discount<money>
  - `monthlyrate_extradaysrateafterdiscount`: rate to apply to extra days when using monthly rates<money>
  - `ratesubtotal`: sub total for this season record. Total if there is only one record.<money>
- **extrafees**
  - `extrafeesid`: id for this extra fee/optional fee/mandatory fee/insurance option <int_id>
  - `name`: name of extra fee/optional fee/mandatory fee/insurance option<string>
  - `type`: type of fee<Daily/Fixed/Percentage>
  - `qty`: quantity - how many times this fee is applied to the booking<int>
  - `numberofdays`: number of days for this fee<int>
  - `fees`: amount or rate of the fee. Check 'type' above - this will be either the daily rate, percentage amount, or fixed amount.<money>
  - `totalfeeamount`: total amount of the fee for this booking<money>
  - `feedescription`: fee/extra/insurance description<string>
  - `payagency`: true if agency receives commission on this fee (agent bookings only)
  - `isoptionalfee`: true if this is an option extra fee<true/false>
  - `isbondfee`: true if this is a bond fee<true/false>
  - `isinsurancefee`: true if this is an insurance fee<true/false>
  - `insuranceexcessamount`: amount of excess (insurance fees only)<money>
- **paymentinfo**
  - `paidamount`: amount paid<money>
  - `paymenttype`: payment typee.g.'Agent collected','VISA','Cash' etc.<string>
  - `paymentdate`: date of payment<date dd/MMM/yyyy>
  - `merchantfee_id`: id for the merchant fee applied to this payment <int_id>
  - `merchantfee_name`: name of the merchant fee <string>
  - `merchantfee_amount`: amount of the merchant fee <money>
  - `merchantfee_amountincltax`: amount of the merchant fee including tax <money>
  - `totalpaymenttaken`: amount of payment including merchant fee <money>
  - `paysource`: payment source <string>
  - `billinglocation`: location payment was taken, if applicable <string>
- **extradrivers**
  - `customerid`: customer id of extra driver<int_id>
  - `firstname`: first name <string>
  - `lastname`: last name<string>
  - `dateofbirth`: date of birth<date dd/MMM/yyyy>
  - `email`: <string>
  - `phone`: <string>
  - `mobile`: <string>
  - `address`: <string>
  - `city`: <string>
  - `state`: <string>
  - `postcode`: <string>
  - `countryid`: reference to country record<int_id>
  - `country`: country name<string>
  - `licenseno`: license number<string>
  - `licenseexpires`: drivers license expires date or string <date dd/MMM/yyyy> or <string 'lifetime'>
  - `licenseissued`: license issued by<string>

</details>

## `calctotal`

Method to calculate total values + taxes based on selections made within step3

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `pickuplocationid` | number | yes | Pickup location id |
| `pickupdate` | date | yes | Pickup date |
| `vehiclecategoryid` | number | yes | Vehicle Category ID as returned in dataset availablecars when calling method step3 |
| `numberofdays` | number | yes | Number of days as returned in dataset availablecars when calling method step3 |
| `totalrateafterdiscount` | number | yes | Amount Total Rate After Discount returned in dataset availablecars when calling method step3 |
| `freedaysamount` | number | yes | Amount for Free Days as returned in dataset availablecars when calling method step3 |
| `insuranceid` | number | yes | Selected Insurance ID |
| `extrakmsid` | number | yes | Selected Extra Kms ID |
| `mandatoryfees` | json:mandatoryfees | no | Mandatory extra fees, smaller subset (id and qty only) of the dataset 'mandatoryfees' returned from method step3. json data containing 1:n mandatory extra fees eq. [{'id':1,'qty':2},..] |
| `optionalfees` | json:optionalfees | no | Optional extra fees selected in step3, json data containing 1:n optional extra fees eq. [{'id':1,'qty':2},..] |
| `packageid` | number | no | Optional: Package ID as defined within the RCM System |

<details><summary>Output</summary>

- **totals**
  - `type`: this record's type, e.g. 'total rate','freedays', 'kmsrate', 'mandatory', 'optional', 'insurance', 'state tax', 'country tax', 'total'<string>
  - `id`: id of fee if this record is a fee type, e.g. insurance, mandatory etc<int_id>
  - `name`: name or description of this record if applicable, e.g. insurance name, tax name etc <string>
  - `qty`: quantity of this record to apply<int>
  - `total`: total amount for this record<money>

</details>

## `cancelbooking`

Method to cancel a booking

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `reservationref` | string(30) | yes | Booking reference code returned from method agentbookings |
| `reasonid` | number | yes | Cancel Reason ID |
| `cancelfeeid` | number | no | Cancellation Fee ID (If known) |

<details><summary>Output</summary>

- `success`: true if booking successfully cancelled<true/false>
- `successmsg`: success message ('OK') or error message if booking not successfully cancelled <string>
- `reservationref`: reservation reference - used to identify the booking <string>

</details>

## `cancelreasons`

Method to list reasons for cancelations

<details><summary>Output</summary>

- `id`: id of this cancellation reason<int_id>
- `reason`: value for this cancellation reason<string>

</details>

## `categorylist`

Method to list all vehicle categories

<details><summary>Output</summary>

- `id`: <int_id>
- `vehiclecategorytypeid`: reference to vehicle category type id<int_id>
- `categorytype`: vehicle category type <string>
- `vehiclecategoryname`: vehicle category name <string>
- `description`: vehicle category description for display <string>
- `numberofadults`: number of adults this vehicle category can accommodate <int>
- `numberofchildren`: number of children this vehicle category can accommodate <int>
- `numberoflargecases`: number of large cases this vehicle category can accommodate <int>
- `numberofsmallcases`: number of small cases this vehicle category can accommodate <int>
- `vehicledescription1`: extra vehicle category information that can be used for display <string>
- `vehicledescription2`: extra vehicle category information that can be used for display <string>
- `vehicledescription3`: extra vehicle category information that can be used for display <string>
- `vehicledescriptionurl`: url to a page with more detail about the vehicle category <string>
- `imageurl`: url to an image of the vehicle category <string>
- `sippcode`: rental car industry SIPP code for this vehicle category <string>

</details>

## `categorytypes`

Method to list all category types and their IDs + rate type info

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number | no | Category Type ID to list only the selected category type |

<details><summary>Output</summary>

- `id`: vehicle category type id<int_id>
- `vehiclecategorytype`: vehicle category type name<string>
- `displayorder`: order by this field for display<string>

</details>

## `confirmpayment` (alias `savepayment`)

Method to save 3rd party payment data like Paypal, Windcave etc...

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `reservationref` | string(30) | yes | Booking reference code returned from method booking |
| `amount` | number | yes | Payment Amount |
| `success` | boolean | yes | Indicate if payment was successfull |
| `paytype` | string(30) | yes | Payment type, like visa or mastercard |
| `paydate` | date | yes | Payment date |
| `supplierid` | number | yes | Token Supplier ID, as specified within the RCM system |
| `transactid` | string(100) | no | Optional Transaction Billing ID, provided by the 3rd party Payment solution eg. Windcave/VostroPay token for rebilling |
| `dpstxnref` | string(50) | no | Optional Payment Gateway transaction reference - unique identifier for this transaction |
| `cardholder` | string(50) | no | Optional Name of card holder |
| `paysource` | string(50) | no | Optional Payment Source eq. 'Payment from Web API3.x' |
| `cardnumber` | string(20) | no | Optional Partial Credit Card Number. Credit card number needs to be truncated or masked eq. ############1111, whole creditcard numbers will be rejected by the system |
| `cardexpiry` | string(20) | no | Optional Credit card expiry details eq. 01/19 |
| `transtype` | string(20) | no | Optional transaction type. When value='Auth', 0 value is allowed for @amount parameter. If using a payment gateway integration in RCM (e.g. Stripe or Windcave) this parameter should be either "Payment" or "Auth". |
| `merchfeeid` | number | no | Optional Merchant Fee ID corresponding to a Merchant Fee ID setup within the system |
| `payscenario` | number | no | Payment scenario when calling this method, possible values are: 1= at time of original booking (default), 2=convertquote, 3=prehire e.g. editbooking |
| `emailoption` | number | no | Email option, 0=never send email, 1=default behaviour, 2=always send email |
| `authamount` | number | no | Authorisation amount, should only be passed in when 'transtype' is 'auth' |
| `billinglocationid` | number | no | Optional parameter for changing the billing location ID to a specified value. |
| `loginid` | number | no | Optional parameter for changing the user attached to this payment to a specified value. |

<details><summary>Output</summary>

- `paymentsaved`: true if payment saved successfully<true/false>
- `emailsend`: true if confirmation email sent<true/false>

</details>

## `countries`

Method to List all countries, the ids used by the system for those countries and if it is the default country

<details><summary>Output</summary>

- `id`: id of this country<int_id>
- `country`: country name<string>
- `isdefault`: true if this is the default country to display<true/false>

</details>

## `createdpspayment`

Method to create a Windcave payment

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `reservationref` | string(30) | yes | Booking reference code returned from method booking |
| `amount` | number | yes | Payment amount |
| `returnurl` | string | yes | Url-encoded Url that Payment Express will call after the payment has been processed. |
| `transactiontype` | string | no | Purchase, Authorization or Validate.Default is Purchase. |

<details><summary>Output</summary>

- `ReturnUrl`: Payment Express will redirect the user to this url after the payment has been processed <string>
- `RedirectUrl`: the url for the Payment Express payment page <string>
- `TransactionType`: purchase, authorization or validate

</details>

## `createpaymenttransaction`

Method to create a payment transaction across multiple payment gateways. A payment transaction could be a card registration only without a payment amount

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `paymentgatewaytype` | string(30) | yes | Identifier for the payment gateway to use. VostroPay is currently the only supported gateway. |
| `reservationref` | string(30) | yes | Booking reference code returned from method booking |
| `transactiontype` | string | no | Type of transaction. 'cardregistration' or 'payment'. |
| `amount` | number | no | Total amount if for a payment. For card registrations enter 0. If a merchant fee was used in payment, this fee is included in the amount (enter merchfeeid below)' |
| `merchfeeid` | number | no | RCM Merchant Fee ID, if used in payment. Not required for card registration. |
| `merchfeeamount` | number | no | Merchant Fee amount, if used in payment. This value should be included in the payment 'amount' field. Not required for card registration. |
| `payscenario` | number | no | Payment scenario when calling this method, possible values are: 1= at time of original booking (default), 2=convertquote, 3=prehire e.g. editbooking |
| `paysource` | string(50) | no | Optional Payment Source eq. 'Payment from Web API3.x' |
| `emailoption` | number | no | Email option, 0=never send email, 1=default behaviour, 2=always send email |
| `additionalparameters` | object | no | JSON object containing gateway-specific parameters. VostroPay default behaviour does not require anything here. |

## `customer`

Dataset with customer data used within other methods like booking or editbooking

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number | conditional | Customer ID, required when using method editbooking |
| `lastname` | string(40) | yes | Last name of customer |
| `firstname` | string(30) | no | First name of customer |
| `email` | string(50) | yes | Email of customer |
| `dateofbirth` | date | no | Date of birth |
| `address` | string(80) | no | Address |
| `city` | string(50) | no | City |
| `state` | string(30) | no | State |
| `postcode` | string(10) | no | Postcode |
| `countryid` | number | no | Country ID |
| `phone` | string(20) | no | Phone Number |
| `mobile` | string(25) | no | Mobile Phone Number |
| `fax` | string(15) | no | Fax number |
| `licenseno` | string(70) | no | Driver License Number |
| `licenseissued` | string(20) | no | Driver License Issued From (state name/ country id) |
| `licenseexpires` | date | no | Driver License Expiry date. If 'lifetime' please set the year to 3000. |
| `passport` | string(50) | no | Passport number |
| `companycode` | string(20) | no | Company Code |

## `customfields`

Method to get all custom fields for a table

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `table` | string | yes | name of the table with custom fields (must be either locations, vehiclecategories or fees) |

<details><summary>Output</summary>

- `id`: <int_id>
- `table`: the name of the table that these fields belong to <string>
- `fieldname`: custom field name <string>
- `description`: custom field description <string>
- `value`: custom field value <string>
- `vehiclecategory`: the vehicle category name if the selected table is vehiclecategories <string>
- `vehiclecategoryid`: the vehicle category id if the selected table is vehiclecategories <int>
- `fee`: the fee name if the selected table is fees <string>
- `feeid`: the fee id if the selected table is fees <int>
- `location`: the location name if the selected table is locations <string>
- `locationid`: the location id if the selected table is locations <int>

</details>

## `donotrent`

Check if a customer matches an existing do not rent customer.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customer` | json:customer | yes | Customer data like last name, driver license etc... using json string |

<details><summary>Output</summary>

- `donotrent`: true if the customer is found in the do not rent list <true/false>

</details>

## `driverages`

Method to list all valid driver ages within in system and their IDs + indication for default age

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number | no | Driver age id to list only the selected driver age item from list |

<details><summary>Output</summary>

- `id`: driver age id<int_id>
- `driverage`: actual age for this value <int>
- `isdefault`: true if this is the age to select by default<true/false>

</details>

## `editbooking` (alias `editbookingdeprecated`)

Method to update selected booking or quotation

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `reservationref` | string(30) | yes | Booking reference code returned from method booking or editbooking |
| `pickuplocationid` | number | yes | pickup location id |
| `bookingtype` | number | yes | Booking type (1=quote, 2=booking) |
| `insuranceid` | number | yes | Insurance ID |
| `extrakmsid` | number | yes | Extra Kms ID |
| `transmission` | number | yes | Transmission preference: 0=no preference, 1=auto, 2=manual |
| `emailoption` | number | no | Email option, 0=never send email, 1=default behaviour, 2=always send email |
| `referralid` | number | no | Referral ID for Referral Booking |
| `foundusid` | number | no | Found Us ID |
| `remark` | string(250) | no | Booking remarks by customer |
| `numbertravelling` | number | conditional | Number of people traveling |
| `flightin` | string(50) | no | Flight Number Arrival |
| `flightout` | string(50) | no | Flight Number Departure |
| `arrivalpoint` | string(80) | no | Arrival Collection Point |
| `departurepoint` | string(80) | no | Departure Return Point |
| `areaofuseid` | number | no | Area Of Use ID |
| `newsletter` | boolean | no | Newsletter flag: 0=no newsletter, 1=sign up for newsletter |
| `agentcode` | string(20) | no | Agent code (max. length=20) |
| `agentname` | string(20) | no | Agent name (max. length=20) |
| `agentemail` | string(50) | no | Agent email (max. length=50) |
| `agentrefno` | string(50) | no | Agent reference code (max. length=50) |
| `customer` | json:customer | yes | Customer data like last name, driver license etc... using json string |
| `optionalfees` | json:optionalfees | no | Optional extra fees, json data containing 1:n optional extra fees eq. [{'id':1,'qty':2},..] |

<details><summary>Output</summary>

- `reservationref`: reservation reference - used to identify the booking<string>
- `reservationno`: reservation number - used within RCM to identify the booking, appears on customer documents<int_id>
- `customerid`: customer id for this booking <int_id>

</details>

## `extend`

Extend allocated bookings based on their reference number. Only to be used for allocated bookings!

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `reservationref` | string(30) | conditional | Booking reference code returned from method booking or editbooking |
| `reservationno` | number | conditional | Reservation number |
| `dropoffdate` | date | yes | New Drop off date |
| `dropofftime` | time | yes | New Drop off time |

## `getdpspayment`

Method to get the details of a Windcave payment

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `reservationref` | string(30) | yes | Booking reference code returned from method booking |
| `result` | string | yes | Result returned in query string from Windcave callback url |

<details><summary>Output</summary>

- `Amount`: payment amount <number>
- `TransactionDate`: transaction date <string>
- `Status`: payment status <string>
- `TransactionId`: Payment Express transaction id
- `RebillingToken`: Payment Express rebilling token
- **Card**
  - `Cardholder`: card holder name <string>
  - `PayType`: card type <string>
  - `CardNumber`: partial card number <string>
  - `CardExpiry`: card expiry date <string>

</details>

## `getvaulturl` (alias `geturl`)

Method to get url (in base64 string encoding) used to access the vault to allow user to submit their credit card details, using 3rd party vault supplier.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `reservationref` | string(30) | yes | Booking reference code returned from method booking |

<details><summary>Output</summary>

- `url`: url to display to customer to allow them to enter credit card details into secure vault<string>

</details>

## `list`

Method to list all methods in API or a particular method specified by optional parameter 'name'

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | no | name of the method you want to have info about eq. step2 |

## `locationdetails`

Method to get specific location details like address, toll free number etc..

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number | no | location id to list only the selected location id, or all locations |

<details><summary>Output</summary>

- `id`: location id<int_id>
- `location`: location name<string>
- `address`: location address<string>
- `city`: location city<string>
- `suburb`: location suburb<string>
- `postcode`: location postcode<string>
- `state`: location state<string>
- `country`: location country<string>
- `freecalllocal`: location free call local number <string>
- `fax`: location fax number<string>
- `airportcodeid`: location airport code<string>
- `isdefault`: true if default location<true/false>
- `ispickupavailable`: true if pickups are available from this location<true/false>
- `isdropoffavailable`: true if drop-offs are available at this location<true/false>
- `isflightinrequired`: true if flight number (flightin) is required for this location<true/false>
- `minimumbookingday`: minimum number of days for a booking from this location<int>
- `noticerequired_numberofdays`: number of days notice required for a booking from this location<int>
- `quoteisvalid_numberofdays`: number of days a quotation is valid <int>
- `officeopeningtime`: office opening time at this location<24hourtime – HH:mm>
- `officeclosingtime`: office closing time at this location<24hourtime – HH:mm>
- `afterhourbookingaccepted`: true if bookings are accepted outside of office hours<true/false>
- `afterhourfeeid`: a reference to the mandatoryFee id if booking is after hours<int_id>
- `unattendeddropoffaccepted`: true if drop-offs are accepted outside of office hours<true/false>
- `unattendeddropofffeeid`: a reference to the mandatoryFee id if drop-off is outside office hours<int_id>
- `minimumage`: minimum age of driver at this location<int>
- `phone`: location phone number<string>
- `email`: location email address<string>
- `mapurl`: url to a map showing the location<string>
- `webdescription`: web (html) description for this location, e.g. how to find us <string>

</details>

## `locations`

Method to list all locations their IDs, location relavant booking details like office hours, after hours drop off etc... and indication if it is the default location

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number | no | location id to list only the selected location id |

<details><summary>Output</summary>

- `id`: location id<int_id>
- `location`: location name<string>
- `isdefault`: true if default location<true/false>
- `ispickupavailable`: true if pickups are available from this location<true/false>
- `isdropoffavailable`: true if drop-offs are available at this location<true/false>
- `isflightinrequired`: true if flight number (flightin) is required for this location<true/false>
- `minimumbookingday`: minimum number of days for a booking from this location<int>
- `noticerequired_numberofdays`: number of days notice required for a booking from this location<int>
- `quoteisvalid_numberofdays`: number of days a quotation is valid <int>
- `officeopeningtime`: office opening time at this location<24hourtime – HH:mm>
- `officeclosingtime`: office closing time at this location<24hourtime – HH:mm>
- `afterhourbookingaccepted`: true if bookings are accepted outside of office hours<true/false>
- `afterhourfeeid`: a reference to the mandatoryFee id if booking is after hours<int_id>
- `unattendeddropoffaccepted`: true if drop-offs are accepted outside of office hours<true/false>
- `unattendeddropofffeeid`: a reference to the mandatoryFee id if drop-off is outside office hours<int_id>
- `minimumage`: minimum age of driver at this location<int>
- `phone`: location phone number<string>
- `email`: location email address<string>

</details>

## `mandatoryfees`

Dataset listing mandatory fees and their quantities used within other methods like calctotal

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number | no | Mandatory Fee ID |
| `qty` | number | conditional | Quantity related to given Mandatory Fee ID |

## `optionalfees`

Dataset listing optional fees and their quantities used within other methods like booking or editbooking

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number | no | Optional Fee ID |
| `qty` | number | conditional | Quantity related to given Optional Fee ID |

## `output`

Method to list dataset output for all methods in API or a particular method specified by optional parameter 'name'

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | no | name of the method you want to have output info about eq. step2 |

## `packages`

List available packages and their corresponding mandatory extras, KMs charges and insurance options.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `packageid` | number | no | The ID of the package |
| `pickuplocationid` | number | no | Pickup location ID |
| `dropofflocationid` | number | no | Dropoff location ID |
| `pickupdate` | date | no | Pickup date |
| `dropoffdate` | date | no | Dropoff date |
| `vehiclecategoryid` | number | no | Vehicle category ID |
| `vehiclecategorytypeid` | number | no | Vehicle category type ID |
| `numberofdays` | number | no | Booking length in days |
| `campaigncode` | string(30) | no | Campaign code |

<details><summary>Output</summary>

- **packages**
  - `id`: package id <int_id>
  - `name`: name of package <string>
  - `pickuplocationid`: id of pickup location for this package <int_id>
  - `pickuplocation`: name of pickup location for this package <string>
  - `dropofflocationid`: id of dropoff location for this package <int_id>
  - `dropofflocation`: name of dropoff location for this package <string>
  - `vehiclecategoryid`: id of vehicle category for this package <int_id>
  - `vehiclecategory`: name of vehicle category for this package <string>
  - `minimumbookingdays`: minimum number of booking days <int>
  - `maximumbookingdays`: maximum number of booking days <int>
  - `costdescription`: human readable summary of package cost <string>
  - `packagecosttype`: package type (Total Cost/Daily Rate) <string>
  - `totalcost`: package total cost <money>
  - `dailyrate`: package daily rate <money>
  - `pickupdatefrom`: start of pickup period for this package <date dd/MM/yyyy>
  - `pickupdateto`: end of pickup period for this package <date dd/MM/yyyy>
  - `bookingdatefrom`: start of booking period for this package <date dd/MM/yyyy>
  - `bookingdateto`: end of booking period for this package <date dd/MM/yyyy>
  - `description`: description of package <string>
  - `imageurl`: url of package image <string>
- **mandatoryfees**
  - `id`: extra fee id <int_id>
  - `packageid`: package id <int_id>
  - `vehiclecategorytypeid`: reference to vehicle category type id that this fee applies to.0 means all.<int_id>
  - `vehiclecategoryid`: reference to vehicle category type id that this fee applies to.0 means all.<int_id>
  - `numberofdays`: number of days fee applies to, if applicable. uses package minimumbookingdays if no dates are provided <real>
  - `qty`: quantity - number of times this fee is applied <int>
  - `fees`: extra fee cost <money>
  - `totalfeeamount`: total amount of the fee for this booking. if type is not fixed and no dates are provided, package minimumbookingdays is used to calculate this <money>
  - `name`: name of extra fee <string>
  - `type`: type of fee <Daily/Fixed/Percentage>
  - `maximumprice`: maximum price of the fee if set<money>
  - `stampduty`: true if fee is inclusive of stamp duty<true/false>
  - `gst`: true if fee is inclusive of gst<true/false>
  - `ispercentageontotalcost`: true if this fee is calculated as a percentage of total cost of booking (including extras/insurances/fees). false if this fee is percentage of rental rates only.(applies to percentage-type fees only)<true/false>
  - `merchantfee`: true if this is a merchant fee e.g. credit card surcharge<true/false>
  - `feedescription`: fee description<string>
  - `feedescription1`: fee description 1 <string>
  - `feedescription2`: fee description 2 <string>
  - `feedescription3`: fee description 3 <string>
- **insuranceoptions**
  - `id`: id for this insurance option<int_id>
  - `packageid`: package id <int_id>
  - `vehiclecategorytypeid`: reference to vehicle category type id that this fee applies to.0 means all.<int_id>
  - `vehiclecategoryid`: reference to vehicle category type id that this fee applies to.0 means all.<int_id>
  - `numberofdays`: number of days fee applies to, if applicable. uses package minimumbookingdays if no dates are provided <real>
  - `fees`: amount or rate of the fee. Check 'type' below - this will be either the daily rate, percentage amount, or fixed amount.<money>
  - `name`: name of the insurance option<string>
  - `type`: type of fee<Daily/Fixed/Percentage>
  - `maximumprice`: maximum price of the fee if set<money>
  - `totalinsuranceamount`: total amount of this insurance option for the booking. if type is not fixed and no dates are provided, package minimumbookingdays is used to calculate this <money>
  - `payagency`: true if agency receives commission on this fee (agent bookings only)
  - `stampduty`: true if fee is inclusive of stamp duty<true/false>
  - `gst`: true if fee is inclusive of gst<true/false>
  - `ispercentageontotalcost`: true if this fee is calculated as a percentage of total cost of booking (including extras/insurances/fees). false if this fee is percentage of rental rates only.(applies to percentage-type fees only)<true/false>
  - `excessamount`: amount of excess that applies to this insurance option<money>
  - `isdefault`: true if this is the default insurance option<true/false>
  - `feedescription`: insurance description<string>
  - `feedescription1`: insurance description 1 <string>
  - `feedescription2`: insurance description 2 <string>
  - `feedescription3`: insurance description 3 <string>
- **kmcharges**
  - `id`: km charge id <int_id>
  - `packageid`: package id <int_id>
  - `vehiclecategorytypeid`: reference to vehicle category type id <int_id>
  - `numberofdays`: number of days of booking. uses package minimumbookingdays if no dates are provided <real>
  - `mileagedesc`: e.g. miles/kilometres <string>
  - `description`: description of km charge <string>
  - `totalamount`: total amount of this option for the booking. uses package minimumbookingdays if no dates are provided <money>
  - `numberofkmsfree`: number of kilometres/miles per day that are included for this option free of charge<int>
  - `feeforeachadditionalkm`: fee charged for each additional kilometre/mile above 'numberofkmsfree' amount<money>
  - `isdefault`: true if this is the default kilometre charges option<true/false>
  - `maximumprice`: maximum price for this option if set<money>
  - `dailyrate`: daily rate that applies for this option<money>
  - `notes`: notes about this kilometre charges option<string>

</details>

## `rebillingtoken`

Method to save 3rd party rebilling tokens like Stripe, Windcave etc...

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `reservationref` | string(30) | yes | Booking reference code returned from method booking |
| `paytype` | string(30) | yes | Payment type, like visa or mastercard |
| `supplierid` | number | yes | Token Supplier ID, as specified within the RCM system |
| `rebillingtoken` | string(100) | no | Rebilling token, provided by the 3rd party Payment solution eq. Stripe setup intent ID for rebilling |
| `payscenario` | number | no | Payment scenario when calling this method, possible values are: 1= at time of original booking (default), 2=convertquote, 3=prehire e.g. editbooking |
| `cardholder` | string(50) | no | Optional Name of card holder |
| `paysource` | string(50) | no | Optional Payment Source eq. 'Payment from Web API3.x' |
| `cardnumber` | string(20) | no | Optional Partial Credit Card Number. Credit card number needs to be truncated or masked eq. ############1111, whole creditcard numbers will be rejected by the system |
| `cardexpiry` | string(20) | no | Optional Credit card expiry details eq. 01/19 |
| `emailoption` | number | no | Email option, 0=never send email, 1=default behaviour, 2=always send email |
| `supplieraccountid` | string | no | Payment Gateway Account ID, as specified within the RCM system, if known. May be important if there is more than one account for the Payment Gateway. Check with RCM Support if unsure. |

<details><summary>Output</summary>

- `tokensaved`: true if token saved successfully<true/false>
- `emailsend`: true if confirmation email sent<true/false>
- `errormsg`: reason why tokensaved is false <string>

</details>

## `relocationspecials`

List available relocation specials

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `pickuplocationid` | number | no | pickup location id |
| `vehiclecategorytypeid` | number | no | vehicle category type id |
| `vehiclecategoryid` | number | no | vehicle category id |

<details><summary>Output</summary>

- `id`: unique identifier of the relocation special deal <int_id>
- `pickuplocationid`: unique id of pickup location for this special <int_id>
- `pickuplocation`: name of pickup location for this special <string>
- `dropofflocationid`: unique id of drop off location for this special <int_id>
- `dropofflocation`: name of drop off location for this special <string>
- `vehiclecategorytypeid`: reference to vehicle category type id<int_id>
- `vehiclecategorytype`: vehicle category type name<string>
- `vehiclecategoryid`: vehicle category id<int_id>
- `vehiclecategory`: vehicle category name<string>
- `vehicledescription1`: extra vehicle category information that can be used for display <string>
- `vehicledescription2`: extra vehicle category information that can be used for display <string>
- `vehicledescription3`: extra vehicle category information that can be used for display <string>
- `pickupdatefrom`: start of pickup period for this special <date dd-MMM-yyyy>
- `pickupdateto`: end of pickup period for this special <date dd-MMM-yyyy>
- `dropoffdateend`: last possible drop off date for this special <date dd-MMM-yyyy>
- `maxbookingdays`: maximum number of days for a booking under this special deal <int>
- `dailyrate`: daily rate for the special deal<money>
- `onewayfeeid`: unique id of a fee if it applies to this special <int_id>
- `onewayfeename`: name of fee if it applies to this special <string>
- `onewayfeecost`: cost of fee if it applies to this special <money>
- `currencyname`: name of currency e.g. AUD<string>
- `currencysymbol`: symbol of currency e.g. $<string>
- `offerdescription`: description/conditions of the special deal <string>

</details>

## `sendemail`

Method to send an email based on a fixed layout defined within the RCM system

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `reservationref` | string(30) | yes | Booking reference code returned from method booking |
| `emailtypename` | string(30) | no | Type of email to send, e.g. comfirmation email or rental agreement, possible values: [confirmation, agreement]. Default is confirmation. |

<details><summary>Output</summary>

- `sendemail`: <success/failed><string>

</details>

## `step1` (alias `vehiclecategorylocations`)

Initial step to get Renting Locations and Vehicle Category Types

<details><summary>Output</summary>

- **locations**
  - `id`: location id<int_id>
  - `location`: location name<string>
  - `isdefault`: true if default location<true/false>
  - `ispickupavailable`: true if pickups are available from this location<true/false>
  - `isdropoffavailable`: true if drop-offs are available at this location<true/false>
  - `isflightinrequired`: true if flight number (flightin) is required for this location<true/false>
  - `minimumbookingday`: minimum number of days for a booking from this location<int>
  - `noticerequired_numberofdays`: number of days notice required for a booking from this location<int>
  - `quoteisvalid_numberofdays`: number of days a quotation is valid <int>
  - `officeopeningtime`: office opening time at this location<24hourtime – HH:mm>
  - `officeclosingtime`: office closing time at this location<24hourtime – HH:mm>
  - `afterhourbookingaccepted`: true if bookings are accepted outside of office hours<true/false>
  - `afterhourfeeid`: a reference to the mandatoryFee id if booking is after hours<int_id>
  - `unattendeddropoffaccepted`: true if drop-offs are accepted outside of office hours<true/false>
  - `unattendeddropofffeeid`: a reference to the mandatoryFee id if drop-off is outside office hours<int_id>
  - `minimumage`: minimum age of driver at this location<int>
  - `phone`: location phone number<string>
  - `email`: location email address<string>
- **officetimes**
  - `locationid`: reference to location.id<int_id>
  - `dayofweek`: number of day of week, 1=Sunday, 2=Monday etc.<int>
  - `openingtime`: location office opening time for this day<24hourtime – HH:mm>
  - `closingtime`: location office closing time for this day<24hourtime – HH:mm>
  - `startpickup`: pickups available from this time<24hourtime – HH:mm>
  - `endpickup`:  pickups not available after this time<24hourtime – HH:mm>
  - `startdropoff`: drop-offs available from this time<24hourtime – HH:mm>
  - `enddropoff`: drop-offs not available after this time<24hourtime – HH:mm>
  - `startdate`: the start date for this period (e.g. summer hours vs winter hours) <date> default 01-Jan-1900
  - `enddate`: the end date for this period (e.g. summer hours vs winter hours) <date> default 01-Jan-2100
- **categorytypes**
  - `id`: vehicle category type id<int_id>
  - `vehiclecategorytype`: vehicle category type name<string>
  - `displayorder`: order by this field for display<string>
- **driverages**
  - `id`: driver age id<int_id>
  - `driverage`: actual age for this value <int>
  - `isdefault`: true if this is the age to select by default<true/false>
- **holidays**
  - `id`: holiday id<int_id>
  - `locationid`: reference to location.id for this holiday <int_id>
  - `startdate`: holiday start date<date dd-MMM-yyyy>
  - `enddate`: holiday end date<date dd-MMM-yyyy>
  - `type`: <D/P P -> holiday on pickup date ,D -> holiday on drop-off date>
  - `weekdays`: if this holiday recurs on a specific day of the week, it will be here. 1=Sunday, 2=Monday etc.<int>
  - `holidayname`: holiday name<string>
  - `closingtime`: office hours closing time on this day<24hourtime – HH:mm>

</details>

## `step2` (alias `search`)

Get available vehicles and their rates

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `vehiclecategorytypeid` | idlist | conditional | category type id |
| `pickuplocationid` | number | conditional | pickup location id |
| `pickupdate` | date | conditional | pickup date |
| `pickuptime` | time | conditional | pickup time |
| `dropofflocationid` | number | conditional | dropoff location id |
| `dropoffdate` | date | conditional | dropoff date |
| `dropofftime` | time | conditional | dropoff time |
| `ageid` | number | conditional | Age ID, usually used for indicating the age of the youngest driver. Pass in the id of the relevant record, not the driver's age. |
| `campaigncode` | string(30) | no | Optional: Campaign Code as defined within the RCM System |
| `packageid` | number | no | Optional: Package ID as defined within the RCM System |
| `agentcode` | string(20) | no | Optional: Agent code used for agent portal |
| `name` | string(30) | no | Optional: Name of user, gets logged if used |
| `email` | string(50) | no | Optional: Email of user, gets logged if used |
| `phone` | string(20) | no | Optional: Phone of user, gets logged if used |

<details><summary>Output</summary>

- **locations**
  - `id`: location id<int_id>
  - `location`: location name<string>
  - `isdefault`: true if default location<true/false>
  - `ispickupavailable`: true if pickups are available from this location<true/false>
  - `isdropoffavailable`: true if drop-offs are available at this location<true/false>
  - `isflightinrequired`: true if flight number (flightin) is required for this location<true/false>
  - `minimumbookingday`: minimum number of days for a booking from this location<int>
  - `noticerequired_numberofdays`: number of days notice required for a booking from this location<int>
  - `quoteisvalid_numberofdays`: number of days a quotation is valid <int>
  - `officeopeningtime`: office opening time at this location<24hourtime – HH:mm>
  - `officeclosingtime`: office closing time at this location<24hourtime – HH:mm>
  - `afterhourbookingaccepted`: true if bookings are accepted outside of office hours<true/false>
  - `afterhourfeeid`: a reference to the mandatoryFee id if booking is after hours<int_id>
  - `unattendeddropoffaccepted`: true if drop-offs are accepted outside of office hours<true/false>
  - `unattendeddropofffeeid`: a reference to the mandatoryFee id if drop-off is outside office hours<int_id>
  - `minimumage`: minimum age of driver at this location<int>
  - `phone`: location phone number<string>
  - `email`: location email address<string>
- **officetimes**
  - `locationid`: reference to location.id<int_id>
  - `dayofweek`: number of day of week, 1=Sunday, 2=Monday etc.<int>
  - `openingtime`: location office opening time for this day<24hourtime – HH:mm>
  - `closingtime`: location office closing time for this day<24hourtime – HH:mm>
  - `startpickup`: pickups available from this time<24hourtime – HH:mm>
  - `endpickup`:  pickups not available after this time<24hourtime – HH:mm>
  - `startdropoff`: drop-offs available from this time<24hourtime – HH:mm>
  - `enddropoff`: drop-offs not available after this time<24hourtime – HH:mm>
  - `startdate`: the start date for this period (e.g. summer hours vs winter hours) <date> default 01-Jan-1900
  - `enddate`: the end date for this period (e.g. summer hours vs winter hours) <date> default 01-Jan-2100
- **categorytypes**
  - `id`: vehicle category type id<int_id>
  - `vehiclecategorytype`: vehicle category type name<string>
  - `displayorder`: order by this field for display<string>
- **driverages**
  - `id`: driver age id<int_id>
  - `driverage`: actual age for this value <int>
  - `isdefault`: true if this is the age to select by default<true/false>
- **holidays**
  - `id`: holiday id<int_id>
  - `locationid`: reference to location.id for this holiday <int_id>
  - `startdate`: holiday start date<date dd-MMM-yyyy>
  - `enddate`: holiday end date<date dd-MMM-yyyy>
  - `type`: <D/P P -> holiday on pickup date ,D -> holiday on drop-off date>
  - `weekdays`: if this holiday recurs on a specific day of the week, it will be here. 1=Sunday, 2=Monday etc.<int>
  - `holidayname`: holiday name<string>
  - `closingtime`: office hours closing time on this day<24hourtime – HH:mm>
- **locationfees**
  - `vehiclecategorytypeid`: reference to vehicle category type id<int_id>
  - `loctypeid`: location type (there will be one record for each)<1/2> 1=pickup 2=drop-off
  - `loctype`: location type name<pickup/dropoff>
  - `locationid`: location id<int_id>
  - `currencyname`: name of currency e.g. AUD<string>
  - `currencysymbol`: symbol of currency e.g. $<string>
  - `locdate`: date at location at pickup/drop-off<date dd-MMM-yyyy>
  - `loctime`: time at location at pickup/drop-off<24hourtime – HH:mm>
  - `dayofweekname`: day of week name at pickup/drop-off<string>
  - `location`: location name<string>
  - `locationdatetimenow`: current date and time at location<date yyyy-MM-ddTHH:mm:ss.fff
  - `errorcode`: error code if there is an error for this location<int>
  - `availablemessage`: message about availability at this location on this day. May be an error message if there is an error.<string>
  - `isavailable`: true if this location is available for booking on this day<true/false>
  - `flightnumberrequired`: true if this location requires a flight number for pick ups <true/false>
- **seasonalrates**
  - `vehiclecategorytypeid`: reference to vehicle category type id<int_id>
  - `vehiclecategoryid`: reference to vehicle category id<int_id>
  - `season`: name of season for this rate<string>
  - `rateperiod`: rate period e.g. Day/Week/Month<string>
  - `rateperiod_number`: number of rate periods e.g. 2 (days or months depending on above) <int>
  - `rateperiod_rateafterdiscount`: rate for this rate period<money>
  - `rateperiod_remainingnumberofdays`: left over days after rate period, e.g. 9 day hire using weekly rates, this would be 2<real>
  - `rateperiod_dailyrateafterdiscountforremainingdays`: daily rate for the above number of remaining days<money>
  - `numberofhours`: number of hours for this rate<real>
  - `numberofdays`: number of days for this rate (daily)<real>
  - `dailyratebeforediscount`: rate per day before discount (daily only)<money>
  - `dailyrateafterdiscount`: rate per day after discount (daily only)<money>
  - `ratesubtotal`: total rate for this record(may be a subtotal if other seasons)<money>
  - `discounttype`: type of discount(daily/fixed/percentage)<string>
  - `discountrate`: rate of discount<money>
- **availablecars**
  - `vehiclecategorytypeid`: reference to vehicle category type id<int_id>
  - `vehiclecategoryid`: id field for this particular vehicle category<int_id>
  - `available`: 0 if not available,1 if available, 2 if limited availability<0/1/2><int>
  - `availablemessage`: message about availability<string>
  - `errorcode`: error code if not available<int>
  - `minimumbookingday`: minimum number of booking days for this vehicle category <int>
  - `minimumage`: minimum driver age for this vehicle category<int>
  - `maximumage`: maximum driver age for this vehicle category<int>
  - `vehiclecategory`: vehicle category name<string>
  - `categoryfriendlydescription`: vehicle category friendly description for display<string>
  - `categorybrandid`: brandid if a specific brand is linked to this vehicle category <int>
  - `categorybrandname`: brand name if a specific brand is linked to this vehicle category <string>
  - `numberofhours`: number of hours hire if short hire<real>
  - `hourlyrate`: rate per hour if short hire<money>
  - `numberofdays`: number of days of hire<real>
  - `avgrate`: average rate per day for total hire<money>
  - `totalratebeforediscount`: total amount of hire before discount(does not include insurance/extras)<money>
  - `discounteddailyrate`: daily rate of hire after discount<money>
  - `totalrateafterdiscount`: total amount of hire after discount (does not include insurance/extras)<money>
  - `totaldiscountamount`: total amount of discount<money>
  - `discountrate`: rate of discount<money>
  - `discounttype`: type of discount (daily/fixed/percentage)<string>
  - `freedays`: number of free days included for this hire if any<int>
  - `freedaysamount`: amount of money saved if there are free days included above<money>
  - `imageurl`: url to an image of the vehicle category<string>
  - `numberofadults`: number of adults this vehicle category can accommodate<int>
  - `numberofchildren`: number of children this vehicle category can accommodate<int>
  - `numberoflargecases`: number of large cases this vehicle category can accommodate<int>
  - `numberofsmallcases`: number of small cases this vehicle category can accommodate<int>
  - `sippcode`: SIPP code for the vehicle type e.g. CBAR <string>
  - `vehicledescription1`: vehicle category description 1<string>
  - `vehicledescription2`: vehicle category description 2<string>
  - `vehicledescription3`: vehicle category description 3<string>
  - `vehicledescriptionurl`: url to further information about vehicle category<string>
- **mandatoryfees**
  - `id`: id for this mandatory fee<int_id>
  - `vehiclecategorytypeid`: reference to vehicle category type id that this fee applies to.0 means all.<int_id>
  - `vehiclecategoryid`: reference to vehicle category type id that this fee applies to.0 means all.<int_id>
  - `numberofdays`: number of days fee applies to, if applicable<real>
  - `qty`: quantity - number of times this fee needs to apply <int>
  - `fees`: amount or rate of the fee. Check 'type' below - this will be either the daily rate, percentage amount, or fixed amount. <money>
  - `totalfeeamount`: total amount of the fee for this booking<money>
  - `name`: name of the mandatory fee<string>
  - `type`: type of fee<Daily/Fixed/Percentage>
  - `maximumprice`: maximum price of the fee if set<money>
  - `stampduty`: true if fee is inclusive of stamp duty<true/false>
  - `gst`: true if fee is inclusive of gst<true/false>
  - `ispercentageontotalcost`: true if this fee is calculated as a percentage of total cost of booking (including extras/insurances/fees). false if this fee is percentage of rental rates only.(applies to percentage-type fees only)<true/false>
  - `merchantfee`: true if this is a merchant fee e.g. credit card surcharge<true/false>
  - `feedescription`: fee description<string>
  - `feedescription1`: fee description 1 <string>
  - `feedescription2`: fee description 2 <string>
  - `feedescription3`: fee description 3 <string>
- **optionalfees**
- **insuranceoptions**
  - `id`: id for this insurance option<int_id>
  - `vehiclecategorytypeid`: reference to vehicle category type id that this fee applies to.0 means all.<int_id>
  - `vehiclecategoryid`: reference to vehicle category type id that this fee applies to.0 means all.<int_id>
  - `numberofdays`: number of days rate applies to, if applicable<real>
  - `fees`: amount or rate of the fee. Check 'type' below - this will be either the daily rate, percentage amount, or fixed amount.<money>
  - `name`: name of the insurance option<string>
  - `type`: type of fee<Daily/Fixed/Percentage>
  - `maximumprice`: maximum price of the fee if set<money>
  - `totalinsuranceamount`: total amount of this insurance option for the booking<money>
  - `stampduty`: true if fee is inclusive of stamp duty<true/false>
  - `gst`: true if fee is inclusive of gst<true/false>
  - `ispercentageontotalcost`: true if this fee is calculated as a percentage of total cost of booking (including extras/insurances/fees). false if this fee is percentage of rental rates only.(applies to percentage-type fees only)<true/false>
  - `excessamount`: amount of excess that applies to this insurance option<money>
  - `isdefault`: true if this is the default insurance option<true/false>
  - `feedescription`: insurance description<string>
  - `feedescription1`: insurance description 1 <string>
  - `feedescription2`: insurance description 2 <string>
  - `feedescription3`: insurance description 3 <string>
- **kmcharges**
- **availablecars_p**
  - `vehiclecategorytypeid`: reference to vehicle category type id<int_id>
  - `vehiclecategoryid`: id field for this particular vehicle category<int_id>
  - `packageid`: id of package <int_id>
  - `packagename`: name of package <string>
  - `packagecostdescription`: human readable description of package cost <string>
  - `packagedescription`: package description <string>
  - `packageimageurl`: package image url <string>
  - `available`: 0 if not available,1 if available, 2 if limited availability<0/1/2><int>
  - `availablemessage`: message about availability<string>
  - `errorcode`: error code if not available<int>
  - `minimumbookingday`: minimum number of booking days for this vehicle category <int>
  - `minimumage`: minimum driver age for this vehicle category<int>
  - `maximumage`: maximum driver age for this vehicle category<int>
  - `vehiclecategory`: vehicle category name<string>
  - `categoryfriendlydescription`: vehicle category friendly description for display<string>
  - `categorybrandid`: brandid if a specific brand is linked to this vehicle category <int>
  - `categorybrandname`: brand name if a specific brand is linked to this vehicle category <string>
  - `numberofhours`: number of hours hire if short hire<real>
  - `hourlyrate`: rate per hour if short hire<money>
  - `numberofdays`: number of days of hire<real>
  - `avgrate`: average rate per day for total hire<money>
  - `totalratebeforediscount`: total amount of hire before discount(does not include insurance/extras)<money>
  - `discounteddailyrate`: daily rate of hire after discount<money>
  - `totalrateafterdiscount`: total amount of hire after discount (does not include insurance/extras)<money>
  - `totaldiscountamount`: total amount of discount<money>
  - `discountrate`: rate of discount<money>
  - `discounttype`: type of discount (daily/fixed/percentage)<string>
  - `discountname`: discount name<string>
  - `freedays`: number of free days included for this hire if any<int>
  - `freedaysamount`: amount of money saved if there are free days included above<money>
  - `imageurl`: url to an image of the vehicle category<string>
  - `numberofadults`: number of adults this vehicle category can accommodate<int>
  - `numberofchildren`: number of children this vehicle category can accommodate<int>
  - `numberoflargecases`: number of large cases this vehicle category can accommodate<int>
  - `numberofsmallcases`: number of small cases this vehicle category can accommodate<int>
  - `sippcode`: SIPP code for the vehicle type e.g. CBAR <string>
  - `vehicledescription1`: vehicle category description 1<string>
  - `vehicledescription2`: vehicle category description 2<string>
  - `vehicledescription3`: vehicle category description 3<string>
  - `vehicledescriptionurl`: url to further information about vehicle category<string>
  - `numbervehiclesavailable`: number of available vehicles <int>
  - `vehiclesbookedpercent`: percentage of vehicles that are booked <int>
- **mandatoryfees_p**
  - `id`: id for this mandatory fee<int_id>
  - `packageid`: package id <int_id>
  - `vehiclecategorytypeid`: reference to vehicle category type id that this fee applies to.0 means all.<int_id>
  - `vehiclecategoryid`: reference to vehicle category type id that this fee applies to.0 means all.<int_id>
  - `numberofdays`: number of days fee applies to, if applicable<real>
  - `qty`: quantity - number of times this fee needs to apply <int>
  - `fees`: amount or rate of the fee. Check 'type' below - this will be either the daily rate, percentage amount, or fixed amount. <money>
  - `totalfeeamount`: total amount of the fee for this booking<money>
  - `name`: name of the mandatory fee<string>
  - `type`: type of fee<Daily/Fixed/Percentage>
  - `maximumprice`: maximum price of the fee if set<money>
  - `stampduty`: true if fee is inclusive of stamp duty<true/false>
  - `gst`: true if fee is inclusive of gst<true/false>
  - `ispercentageontotalcost`: true if this fee is calculated as a percentage of total cost of booking (including extras/insurances/fees). false if this fee is percentage of rental rates only.(applies to percentage-type fees only)<true/false>
  - `merchantfee`: true if this is a merchant fee e.g. credit card surcharge<true/false>
  - `feedescription`: fee description<string>
  - `feedescription1`: fee description 1 <string>
  - `feedescription2`: fee description 2 <string>
  - `feedescription3`: fee description 3 <string>
- **insuranceoptions_p**
  - `id`: id for this insurance option<int_id>
  - `packageid`: package id <int_id>
  - `vehiclecategorytypeid`: reference to vehicle category type id that this fee applies to.0 means all.<int_id>
  - `vehiclecategoryid`: reference to vehicle category type id that this fee applies to.0 means all.<int_id>
  - `numberofdays`: number of days rate applies to, if applicable<real>
  - `fees`: amount or rate of the fee. Check 'type' below - this will be either the daily rate, percentage amount, or fixed amount.<money>
  - `name`: name of the insurance option<string>
  - `type`: type of fee<Daily/Fixed/Percentage>
  - `maximumprice`: maximum price of the fee if set<money>
  - `totalinsuranceamount`: total amount of this insurance option for the booking<money>
  - `stampduty`: true if fee is inclusive of stamp duty<true/false>
  - `gst`: true if fee is inclusive of gst<true/false>
  - `ispercentageontotalcost`: true if this fee is calculated as a percentage of total cost of booking (including extras/insurances/fees). false if this fee is percentage of rental rates only.(applies to percentage-type fees only)<true/false>
  - `excessamount`: amount of excess that applies to this insurance option<money>
  - `isdefault`: true if this is the default insurance option<true/false>
  - `feedescription`: insurance description<string>
  - `feedescription1`: insurance description 1 <string>
  - `feedescription2`: insurance description 2 <string>
  - `feedescription3`: insurance description 3 <string>
- **kmcharges_p**
- **availablecars_altrates**
  - `vehiclecategorytypeid`: reference to vehicle category type id<int_id>
  - `vehiclecategoryid`: id field for this particular vehicle category<int_id>
  - `available`: 0 if not available,1 if available, 2 if limited availability<0/1/2><int>
  - `availablemessage`: message about availability<string>
  - `errorcode`: error code if not available<int>
  - `minimumbookingday`: minimum number of booking days for this vehicle category <int>
  - `minimumage`: minimum driver age for this vehicle category<int>
  - `maximumage`: maximum driver age for this vehicle category<int>
  - `vehiclecategory`: vehicle category name<string>
  - `categoryfriendlydescription`: vehicle category friendly description for display<string>
  - `categorybrandid`: brandid if a specific brand is linked to this vehicle category <int>
  - `categorybrandname`: brand name if a specific brand is linked to this vehicle category <string>
  - `numberofhours`: number of hours hire if short hire<real>
  - `hourlyrate`: rate per hour if short hire<money>
  - `numberofdays`: number of days of hire<real>
  - `avgrate`: average rate per day for total hire<money>
  - `totalratebeforediscount`: total amount of hire before discount(does not include insurance/extras)<money>
  - `discounteddailyrate`: daily rate of hire after discount<money>
  - `totalrateafterdiscount`: total amount of hire after discount (does not include insurance/extras)<money>
  - `totaldiscountamount`: total amount of discount<money>
  - `discountrate`: rate of discount<money>
  - `discounttype`: type of discount (daily/fixed/percentage)<string>
  - `discountname`: discount name<string>
  - `freedays`: number of free days included for this hire if any<int>
  - `freedaysamount`: amount of money saved if there are free days included above<money>
  - `imageurl`: url to an image of the vehicle category<string>
  - `numberofadults`: number of adults this vehicle category can accommodate<int>
  - `numberofchildren`: number of children this vehicle category can accommodate<int>
  - `numberoflargecases`: number of large cases this vehicle category can accommodate<int>
  - `numberofsmallcases`: number of small cases this vehicle category can accommodate<int>
  - `sippcode`: SIPP code for the vehicle type e.g. CBAR <string>
  - `vehicledescription1`: vehicle category description 1<string>
  - `vehicledescription2`: vehicle category description 2<string>
  - `vehicledescription3`: vehicle category description 3<string>
  - `vehicledescriptionurl`: url to further information about vehicle category<string>
  - `numbervehiclesavailable`: number of available vehicles <int>
  - `vehiclesbookedpercent`: percentage of vehicles that are booked <int>
  - `rateperiod_typeid`: id field for this rate period type, e.g. 1 for monthly rates, 2 for weekly rates <int_id>
  - `rateperiod_typename`: description of rate period, e.g. month, week <string>
  - `rateperiod_numberofrateperiods`: number of rate periods, e.g. 2 (weeks) or 3 (months) <int>
  - `rateperiod_rateforperiod`: rate per rate period, e.g. $X (per week/month) <money>
  - `rateperiod_numberofremainingdays`: extra days remaining after rate periods, e.g. 7 weeks and X days
  - `rateperiod_rateforremainingdays`: daily rate for extra remaining days <money>
- **mandatoryfees_altrates**
  - `id`: id for this mandatory fee<int_id>
  - `packageid`: package id <int_id>
  - `vehiclecategorytypeid`: reference to vehicle category type id that this fee applies to.0 means all.<int_id>
  - `vehiclecategoryid`: reference to vehicle category type id that this fee applies to.0 means all.<int_id>
  - `numberofdays`: number of days fee applies to, if applicable<real>
  - `qty`: quantity - number of times this fee needs to apply <int>
  - `fees`: amount or rate of the fee. Check 'type' below - this will be either the daily rate, percentage amount, or fixed amount. <money>
  - `totalfeeamount`: total amount of the fee for this booking<money>
  - `name`: name of the mandatory fee<string>
  - `type`: type of fee<Daily/Fixed/Percentage>
  - `maximumprice`: maximum price of the fee if set<money>
  - `stampduty`: true if fee is inclusive of stamp duty<true/false>
  - `gst`: true if fee is inclusive of gst<true/false>
  - `ispercentageontotalcost`: true if this fee is calculated as a percentage of total cost of booking (including extras/insurances/fees). false if this fee is percentage of rental rates only.(applies to percentage-type fees only)<true/false>
  - `merchantfee`: true if this is a merchant fee e.g. credit card surcharge<true/false>
  - `feedescription`: fee description<string>
  - `feedescription1`: fee description 1 <string>
  - `feedescription2`: fee description 2 <string>
  - `feedescription3`: fee description 3 <string>
- `taxinclusive`: true if this booking includes all taxes<true/false>
- `taxrate`: rate of tax <real>
- `statetax`: rate of state tax<real>

</details>

## `step3` (alias `select`)

Select option extras, fees + insurances for selected vehicle

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `vehiclecategorytypeid` | number | yes | Vehicle category type id |
| `pickuplocationid` | number | yes | Pickup location id |
| `pickupdate` | date | yes | Pickup date |
| `pickuptime` | time | yes | Pickup time |
| `dropofflocationid` | number | yes | Dropoff location id |
| `dropoffdate` | date | yes | Dropoff date |
| `dropofftime` | time | yes | Dropoff time |
| `ageid` | number | yes | Age ID, usually used for indicating the age of the youngest driver. Pass in the id of the relevant record, not the driver's age. |
| `vehiclecategoryid` | number | conditional | Vehicle Category ID. Enter this OR vehiclecategorysippcode |
| `vehiclecategorysippcode` | string(8) | conditional | Vehicle Category SIPP Code. Enter this OR vehiclecategoryid |
| `campaigncode` | string(30) | no | Optional: Campaign Code as defined within the RCM System |
| `relocationspecialid` | number | no | Optional: Relocation Special ID as defined within the RCM System |
| `packageid` | number | no | Optional: Package ID as defined within the RCM System |
| `agentcode` | string(20) | no | Optional: Agent code used for agent portal |
| `rateperiod_typeid` | number | no | Optional: rateperiod_typeid if not daily rates - 0:daily rate (default), 1:monthly rate, 2:weekly rate |

<details><summary>Output</summary>

- **driverages**
  - `id`: driver age id<int_id>
  - `driverage`: actual age for this value <int>
  - `isdefault`: true if this is the age to select by default<true/false>
- **rentalsource**
  - `id`: id for this rental source<int_id>
  - `rentalsource`: rental source name<string>
  - `locationid`: reference to location id for this rental source if applicable.0 means all.<int_id>
  - `isdefault`: true if this is the default rental source to display<true/false>
- **countries**
  - `id`: id of this country<int_id>
  - `country`: country name<string>
  - `code`: Country code <string>
  - `isdefault`: true if this is the default country to display<true/false>
- **tender_types**
  - `id`: id for this tender type <int_id>
  - `tendertype`: tender type name <string>
  - `onaccount`: true if tendered amount is on account <true/false>
  - `creditcard`: true if this tender type is a credit card tender type <true/false>
  - `bond`: true if linked to bond <true/false>
  - `extrafee_id`: associated extra fee id, if any <int>
  - `extrafee_name`: extra fee name <string>
  - `extrafee_fee`: extra fee value <number>
  - `extrafee_type`: extra fee type (percent) <string>
- **areaofuse**
  - `id`: id of this area of use record<int_id>
  - `areaofuse`: area of use description<string>
  - `locationid`: reference to location id for this area of use if appliable.0 means all.<int_id>
  - `isdefault`: true if this is the default area of use to display<true/false>
- **locationfees**
  - `vehiclecategorytypeid`: reference to vehicle category type id<int_id>
  - `loctypeid`: location type (there will be one record for each) <1/2> 1=pickup 2=drop-off
  - `loctype`: location type name<pickup/dropoff>
  - `locationid`: location id<int_id>
  - `currencyname`: name of currency e.g. AUD<string>
  - `currencysymbol`: symbol of currency e.g. $<string>
  - `locdate`: date at location at pickup/drop-off<date dd-MMM-yyyy>
  - `loctime`: time at location at pickup/drop-off<24hourtime – HH:mm>
  - `dayofweekname`: day of week name at pickup/drop-off<string>
  - `location`: location name<string>
  - `locationdatetimenow`: current date and time at location<date yyyy-MM-ddTHH:mm:ss.fff
  - `errorcode`: error code if there is an error for this location<int>
  - `availablemessage`: message about availability at this location on this day. May be an error message if there is an error.<string>
  - `isavailable`: true if this location is available for booking on this day<true/false>
- **seasonalrates**
  - `vehiclecategorytypeid`: reference to vehicle category type id<int_id>
  - `vehiclecategoryid`: reference to vehicle category id<int_id>
  - `season`: name of season for this rate<string>
  - `rateperiod`: rate period e.g. Day/Week/Month<string>
  - `rateperiod_number`: number of rate periods e.g. 2 (days or months depending on above) <int>
  - `rateperiod_rateafterdiscount`: rate for this rate period<money>
  - `rateperiod_remainingnumberofdays`: left over days after rate period, e.g. 9 day hire using weekly rates, this would be 2<real>
  - `rateperiod_dailyrateafterdiscountforremainingdays`: daily rate for the above number of remaining days<money>
  - `numberofhours`: number of hours for this rate<real>
  - `numberofdays`: number of days for this rate (daily)<real>
  - `dailyratebeforediscount`: rate per day before discount (daily only)<money>
  - `dailyrateafterdiscount`: rate per day after discount (daily only)<money>
  - `ratesubtotal`: total rate for this record(may be a subtotal if other seasons)<money>
  - `discounttype`: type of discount(daily/fixed/percentage)<string>
  - `discountrate`: rate of discount<money>
- **availablecars**
  - `vehiclecategorytypeid`: reference to vehicle category type id<int_id>
  - `vehiclecategoryid`: id field for this particular vehicle category<int_id>
  - `available`: 0 if not available,1 if available, 2 if limited availability<0/1/2><int>
  - `availablemessage`: message about availability<string>
  - `errorcode`: error code if not available<int>
  - `minimumbookingday`: minimum number of booking days for this vehicle category <int>
  - `minimumage`: minimum driver age for this vehicle category<int>
  - `maximumage`: maximum driver age for this vehicle category<int>
  - `vehiclecategory`: vehicle category name<string>
  - `categoryfriendlydescription`: vehicle category friendly description for display<string>
  - `numberofhours`: number of hours hire if short hire<real>
  - `hourlyrate`: rate per hour if short hire<money>
  - `numberofdays`: number of days of hire<real>
  - `avgrate`: average rate per day for total hire<money>
  - `totalratebeforediscount`: total amount of hire before discount(does not include insurance/extras)<money>
  - `discounteddailyrate`: daily rate of hire after discount<money>
  - `totalrateafterdiscount`: total amount of hire after discount (does not include insurance/extras)<money>
  - `totaldiscountamount`: total amount of discount<money>
  - `discountrate`: rate of discount<money>
  - `discounttype`: type of discount (daily/fixed/percentage)<string>
  - `freedays`: number of free days included for this hire if any<int>
  - `freedaysamount`: amount of money saved if there are free days included above<money>
  - `imageurl`: url to an image of the vehicle category<string>
  - `numberofadults`: number of adults this vehicle category can accommodate<int>
  - `numberofchildren`: number of children this vehicle category can accommodate<int>
  - `numberoflargecases`: number of large cases this vehicle category can accommodate<int>
  - `numberofsmallcases`: number of small cases this vehicle category can accommodate<int>
  - `vehicledescription1`: vehicle category description 1<string>
  - `vehicledescription2`: vehicle category description 2<string>
  - `vehicledescription3`: vehicle category description 3<string>
  - `vehicledescriptionurl`: url to further information about vehicle category<string>
  - `offerdescription`: offer description, if applicable, e.g. for a relocation special <string>
  - `packageid`: package id, if applicable <int_id>
  - `packagename`: package name, if applicable <string>
  - `packagedesc`: package description, if applicable <string>
  - `packageimageurl`: package image url, if applicable <string>
  - `rateperiod_typeid`: id field for this rate type, e.g. 0 for daily rates, 1 for monthly rates, 2 for weekly rates <int_id>
  - `rateperiod_typename`: description of rate type, e.g. day, month, week <string>
  - `rateperiod_numberofrateperiods`: number of rate type periods if other than daily, e.g. 2 (weeks) or 3 (months) <int>
  - `rateperiod_rateforperiod`: rate per rate type period , e.g. $X (per week/month) <money>
  - `rateperiod_numberofremainingdays`: extra days remaining after rate periods, e.g. 7 weeks and X days
  - `rateperiod_rateforremainingdays`: daily rate for extra remaining days <money>
- **mandatoryfees**
  - `id`: id for this mandatory fee<int_id>
  - `packageid`: package id, only returned if the mandatory fee is part of a package <int_id>
  - `vehiclecategorytypeid`: reference to vehicle category type id that this fee applies to.0 means all.<int_id>
  - `vehiclecategoryid`: reference to vehicle category id that this fee applies to.0 means all.<int_id>
  - `numberofdays`: number of days fee applies to, if applicable<real>
  - `qty`: quantity - number of times this fee needs to apply <int>
  - `fees`: amount or rate of the fee. Check 'type' below - this will be either the daily rate, percentage amount, or fixed amount.<money>
  - `totalfeeamount`: total amount of the fee for this booking<money>
  - `name`: name of the mandatory fee<string>
  - `type`: type of fee<Daily/Fixed/Percentage>
  - `payagency`: true if agency receives commission on this fee (agent bookings only)
  - `maximumprice`: maximum price of the fee if set<money>
  - `stampduty`: true if fee is inclusive of stamp duty<true/false>
  - `gst`: true if fee is inclusive of gst<true/false>
  - `ispercentageontotalcost`: true if this fee is calculated as a percentage of total cost of booking (including extras/insurances/fees). false if this fee is percentage of rental rates only.(applies to percentage-type fees only)<true/false>
  - `merchantfee`: true if this is a merchant fee e.g. credit card surcharge<true/false>
  - `feedescription`: fee description<string>
  - `feedescription1`: fee description 1 <string>
  - `feedescription2`: fee description 2 <string>
  - `feedescription3`: fee description 3 <string>
- **optionalfees**
  - `id`: id for this fee<int_id>
  - `vehiclecategorytypeid`: reference to vehicle category type id that this fee applies to.0 means all.<int_id>
  - `vehiclecategoryid`: reference to vehicle category id that this fee applies to.0 means all.<int_id>
  - `locationid`: location id that this fee applies to. 0 means all.<int_id>
  - `displayorder`: order the fees by this value<string>
  - `feegroupid`: group the fees by this value if required<int_id>
  - `feegroupname`: name of the fee grouping if set<string>
  - `numberofdays`: number of days that this fee applies to<real>
  - `payagency`: true if agency receives commission on this fee (agent bookings only)
  - `fees`: amount or rate of the fee. Check 'type' below - this will be either the daily rate, percentage amount, or fixed amount.<money>
  - `totalfeeamount`: total amount of the fee for this booking<money>
  - `name`: name of the optional fee/extra<string>
  - `type`: type of fee<Daily/Fixed/Percentage>
  - `maximumprice`: maximum price of the fee if set<money>
  - `stampduty`: true if fee is inclusive of stamp duty<true/false>
  - `gst`: true if fee is inclusive of gst<true/false>
  - `ispercentageontotalcost`: true if this fee is calculated as a percentage of total cost of booking (including extras/insurances/fees). false if this fee is percentage of rental rates only.(applies to percentage-type fees only)<true/false>
  - `merchantfee`: true if this is a merchant fee e.g. credit card surcharge<true/false>
  - `qtyapply`: quantity apply - true if you can have more than one of these items.<true/false>
  - `feedescription`: fee/extra description<string>
  - `feedescription1`: fee/extra description 1 <string>
  - `feedescription2`: fee/extra description 2 <string>
  - `feedescription3`: fee/extra description 3 <string>
- **insuranceoptions**
  - `id`: id for this insurance option<int_id>
  - `packageid`: package id, only returned if the insurance option is part of a package <int_id>
  - `vehiclecategorytypeid`: reference to vehicle category type id that this fee applies to.0 means all.<int_id>
  - `vehiclecategoryid`: reference to vehicle category type id that this fee applies to.0 means all.<int_id>
  - `numberofdays`: number of days rate applies to, if applicable<real>
  - `fees`: amount or rate of the fee. Check 'type' below - this will be either the daily rate, percentage amount, or fixed amount.<money>
  - `name`: name of the insurance option<string>
  - `type`: type of fee<Daily/Fixed/Percentage>
  - `maximumprice`: maximum price of the fee if set<money>
  - `totalinsuranceamount`: total amount of this insurance option for the booking<money>
  - `payagency`: true if agency receives commission on this fee (agent bookings only)
  - `stampduty`: true if fee is inclusive of stamp duty<true/false>
  - `gst`: true if fee is inclusive of gst<true/false>
  - `ispercentageontotalcost`: true if this fee is calculated as a percentage of total cost of booking (including extras/insurances/fees). false if this fee is percentage of rental rates only.(applies to percentage-type fees only)<true/false>
  - `excessamount`: amount of excess that applies to this insurance option<money>
  - `isdefault`: true if this is the default insurance option<true/false>
  - `feedescription`: insurance description<string>
  - `feedescription1`: insurance description 1 <string>
  - `feedescription2`: insurance description 2 <string>
  - `feedescription3`: insurance description 3 <string>
- **kmcharges**
  - `id`: id of this kilometre charges record<int_id>
  - `packageid`: package id, only returned if the km charge is part of a package <int_id>
  - `vehiclecategorytypeid`: reference to vehicle category type id <int_id>
  - `numberofdays`: number of days of booking<real>
  - `mileagedesc`: <string> e.g. miles/kilometres
  - `description`: description of the kilometre charges record for displaying, e.g. 'Unlimited kilometres, daily rate @ $12.00'<string>
  - `totalamount`: total amount of this option for the booking<money>
  - `numberofkmsfree`: number of kilometres/miles per day that are included for this option free of charge<int>
  - `feeforeachadditionalkm`: fee charged for each additional kilometre/mile above 'numberofkmsfree' amount<money>
  - `isdefault`: true if this is the default kilometre charges option<true/false>
  - `maximumprice`: maximum price for this option if set<money>
  - `dailyrate`: daily rate that applies for this option<money>
  - `notes`: notes about this kilometre charges option<string>
- `taxinclusive`: true if this booking includes all taxes<true/false>
- `taxrate`: rate of tax <real>
- `statetax`: rate of state tax<real>

</details>

## `tender_types`

Method to List all tender types available and their extra fees if any.

## `vaultentry` (alias `payment`)

Method to save data returned from Auric Vault

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `reservationref` | string(30) | yes | Booking reference code returned from method booking |
| `data` | base64 | yes | base 64 encoded data returned from Auric Vault |
| `payscenario` | number | no | Payment scenario when calling this method, possible values are: 1= at time of original booking (default), 2=convertquote, 3=prehire e.g. editbooking |
| `emailoption` | number | no | Email option, 0=never send email, 1=default behaviour, 2=always send email |

<details><summary>Output</summary>

- `paymentsaved`: true if payment saved successfully<true/false>
- `emailsend`: true if confirmation email sent<true/false>
- `restype`: reservation's new status/type <0/1> 0=On Request (limited availability), 1=Confirmed <int>

</details>
