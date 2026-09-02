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
    public void pilotCropAllocationMatchesGunturKazaSnapshot() {
        assertTrue(PilotContract.isPilotCropPlanBalanced());
        assertEquals("18.20", PilotContract.allocatedAcres().toPlainString());
        assertEquals("GNT-KAZA-114/2", PilotContract.PILOT_CROPS.get(0).plotReference());
        assertEquals("GNT-KAZA-98/1", PilotContract.PILOT_CROPS.get(1).plotReference());
        assertEquals("GNT-KAZA-77/4", PilotContract.PILOT_CROPS.get(2).plotReference());
    }

    @Test
    public void webParitySnapshotContainsEveryFarmerWorkspace() {
        assertEquals(10, PilotContract.FARM_HISTORY.size());
        assertEquals(2, PilotContract.INSURANCE_SNAPSHOTS.size());
        assertEquals(8, PilotContract.INTELLIGENCE_SECTIONS.size());
        assertEquals(5, PilotContract.TRAINING_MODULES.size());
        assertEquals(12, PilotContract.TRAINING_MODULES.stream()
            .mapToInt(module -> module.lessons().size()).sum());
        assertEquals(8, PilotContract.SOIL_PRACTICES.size());
        assertEquals(4, PilotContract.SCHEMES.size());
        assertEquals("Not activated", PilotContract.MARKETPLACE_STATE.get(0).detail());
    }

    @Test
    public void otpShapeRequiresExactlySixDigits() {
        assertTrue(PilotContract.isOtpShapeValid("123456"));
        assertFalse(PilotContract.isOtpShapeValid("12345"));
        assertFalse(PilotContract.isOtpShapeValid("abcdef"));
    }
}
