package com.agrighar.farmer;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PilotContractTest {
    @Test
    public void normalizesIndianMobileNumbersToE164() {
        assertEquals("+919000000000", PilotContract.normalizeIndianPhone("90000 00000"));
        assertEquals("+919000000000", PilotContract.normalizeIndianPhone("+91-90000-00000"));
    }

    @Test
    public void rejectsInvalidIndianMobileNumbers() {
        assertNull(PilotContract.normalizeIndianPhone("12345"));
        assertNull(PilotContract.normalizeIndianPhone("5000000000"));
        assertNull(PilotContract.normalizeIndianPhone(null));
    }

    @Test
    public void masksPhoneWithoutRetainingTheFullNumber() {
        assertEquals("+91******0000", PilotContract.maskPhone("+919000000000"));
        assertEquals("", PilotContract.maskPhone("invalid"));
    }

    @Test
    public void pilotCropAllocationBalancesToTwentyAcres() {
        assertTrue(PilotContract.isPilotCropPlanBalanced());
        assertEquals("20.00", PilotContract.allocatedAcres().toPlainString());
    }

    @Test
    public void otpShapeRequiresExactlySixDigits() {
        assertTrue(PilotContract.isOtpShapeValid("123456"));
        assertFalse(PilotContract.isOtpShapeValid("12345"));
        assertFalse(PilotContract.isOtpShapeValid("abcdef"));
    }
}

