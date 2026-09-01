package com.agrighar.farmer;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.UUID;

public final class MainActivity extends Activity {
    private static final String KEY_SESSION = "session_active";
    private static final String KEY_PHONE_MASKED = "phone_masked";
    private static final String KEY_CONSENT = "baseline_consent_active";
    private static final String KEY_RECEIPT = "baseline_consent_receipt";
    private static final String KEY_PROFILE_NAME = "profile_name";
    private static final String KEY_PROFILE_GENDER = "profile_gender";
    private static final String KEY_DRAFT_SAVED_AT = "draft_saved_at";

    private static final String DEMO_OTP = "123456";

    private SecureStore store;
    private String pendingPhone;

    @Override
    protected void attachBaseContext(Context newBase) {
        Locale locale = Locale.forLanguageTag(PilotContract.PRIMARY_LOCALE);
        Locale.setDefault(locale);
        Configuration configuration = new Configuration(newBase.getResources().getConfiguration());
        configuration.setLocale(locale);
        super.attachBaseContext(newBase.createConfigurationContext(configuration));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        store = new SecureStore(this);
        routeFromState();
    }

    private void routeFromState() {
        if (!store.getBoolean(KEY_SESSION, false)) {
            showLogin();
            return;
        }
        if (!store.getBoolean(KEY_CONSENT, false)) {
            showConsent();
            return;
        }
        if (store.getString(KEY_PROFILE_NAME, "").isBlank()) {
            showProfile(false);
            return;
        }
        showHome();
    }

    private void showLogin() {
        Ui.Page page = Ui.page(this);
        LinearLayout content = page.content();
        addBrandHeader(content, true);
        content.addView(Ui.space(this, 34));
        content.addView(Ui.title(this, getString(R.string.login_title)));
        content.addView(Ui.space(this, 8));
        content.addView(Ui.body(this, getString(R.string.login_body)));
        content.addView(Ui.space(this, 24));

        LinearLayout card = Ui.card(this);
        EditText phoneInput = Ui.phoneInput(this);
        card.addView(Ui.label(this, getString(R.string.phone_hint)));
        card.addView(Ui.space(this, 8));
        card.addView(phoneInput);
        card.addView(Ui.space(this, 14));

        Button request = Ui.primaryButton(this, getString(R.string.request_otp));
        request.setOnClickListener(view -> {
            String normalized = PilotContract.normalizeIndianPhone(phoneInput.getText().toString());
            if (normalized == null) {
                phoneInput.setError(getString(R.string.invalid_phone));
                return;
            }
            if (!BuildConfig.PILOT_DEMO_MODE) {
                toast(R.string.api_not_configured);
                return;
            }
            pendingPhone = normalized;
            showOtp(normalized);
        });
        card.addView(request);
        content.addView(card);
        content.addView(Ui.space(this, 18));
        content.addView(Ui.small(this, getString(R.string.privacy_note)));
        content.addView(Ui.space(this, 26));
        content.addView(Ui.small(this, getString(R.string.contract_footer)));
        setContentView(page.root());
    }

    private void showOtp(String normalizedPhone) {
        Ui.Page page = Ui.page(this);
        LinearLayout content = page.content();
        addBrandHeader(content, true);
        content.addView(Ui.space(this, 30));
        content.addView(Ui.title(this, getString(R.string.otp_title)));
        content.addView(Ui.space(this, 8));
        String masked = PilotContract.maskPhone(normalizedPhone);
        content.addView(Ui.body(this, getString(R.string.otp_body, masked)));
        content.addView(Ui.space(this, 22));

        LinearLayout card = Ui.card(this);
        EditText otpInput = Ui.input(
            this,
            getString(R.string.otp_hint),
            InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD
        );
        otpInput.setMaxLines(1);
        card.addView(otpInput);
        card.addView(Ui.space(this, 12));
        if (BuildConfig.PILOT_DEMO_MODE) {
            card.addView(Ui.pill(this, getString(R.string.demo_otp), true));
            card.addView(Ui.space(this, 12));
        }
        Button verify = Ui.primaryButton(this, getString(R.string.verify_continue));
        verify.setOnClickListener(view -> {
            String otp = otpInput.getText().toString().trim();
            if (!PilotContract.isOtpShapeValid(otp) || !DEMO_OTP.equals(otp)) {
                otpInput.setError(getString(R.string.invalid_otp));
                return;
            }
            store.putBoolean(KEY_SESSION, true);
            store.putString(KEY_PHONE_MASKED, masked);
            pendingPhone = null;
            showConsent();
        });
        card.addView(verify);
        content.addView(card);

        Button changePhone = Ui.textButton(this, getString(R.string.change_phone));
        changePhone.setOnClickListener(view -> {
            pendingPhone = null;
            showLogin();
        });
        content.addView(Ui.space(this, 8));
        content.addView(changePhone);
        setContentView(page.root());
    }

    private void showConsent() {
        Ui.Page page = Ui.page(this);
        LinearLayout content = page.content();
        addBrandHeader(content, true);
        content.addView(Ui.space(this, 26));
        content.addView(Ui.title(this, getString(R.string.consent_title)));
        content.addView(Ui.space(this, 8));
        content.addView(Ui.body(this, getString(R.string.consent_body)));
        content.addView(Ui.space(this, 18));

        LinearLayout card = Ui.card(this);
        CheckBox account = consentCheckBox(getString(R.string.consent_account));
        CheckBox profile = consentCheckBox(getString(R.string.consent_profile));
        CheckBox security = consentCheckBox(getString(R.string.consent_security));
        CheckBox subject = consentCheckBox(getString(R.string.consent_confirm));
        card.addView(account);
        card.addView(profile);
        card.addView(security);
        card.addView(Ui.space(this, 8));
        card.addView(Ui.divider(this));
        card.addView(Ui.space(this, 8));
        card.addView(subject);
        content.addView(card);

        content.addView(Ui.space(this, 14));
        content.addView(Ui.body(this, getString(R.string.consent_optional_note)));
        content.addView(Ui.space(this, 14));
        content.addView(Ui.pill(this, BuildConfig.CONSENT_CONTRACT_VERSION, false));
        content.addView(Ui.space(this, 18));

        Button accept = Ui.primaryButton(this, getString(R.string.accept_continue));
        accept.setEnabled(false);
        View.OnClickListener update = view -> accept.setEnabled(
            account.isChecked() && profile.isChecked() && security.isChecked() && subject.isChecked()
        );
        account.setOnClickListener(update);
        profile.setOnClickListener(update);
        security.setOnClickListener(update);
        subject.setOnClickListener(update);
        accept.setOnClickListener(view -> {
            if (!account.isChecked() || !profile.isChecked() || !security.isChecked() || !subject.isChecked()) {
                toast(R.string.consent_required);
                return;
            }
            store.putBoolean(KEY_CONSENT, true);
            store.putString(KEY_RECEIPT, "local-pending:" + UUID.randomUUID());
            showProfile(false);
        });
        content.addView(accept);

        Button signOut = Ui.textButton(this, getString(R.string.sign_out));
        signOut.setOnClickListener(view -> clearLocalSession());
        content.addView(Ui.space(this, 8));
        content.addView(signOut);
        setContentView(page.root());
    }

    private void showProfile(boolean fromHome) {
        Ui.Page page = Ui.page(this);
        LinearLayout content = page.content();
        addBackHeader(content, fromHome ? this::showHome : null);
        content.addView(Ui.space(this, 18));
        content.addView(Ui.title(this, getString(R.string.profile_title)));
        content.addView(Ui.space(this, 8));
        content.addView(Ui.body(this, getString(R.string.profile_body)));
        content.addView(Ui.space(this, 20));

        LinearLayout card = Ui.card(this);
        card.addView(Ui.label(this, getString(R.string.name_label)));
        card.addView(Ui.space(this, 8));
        EditText nameInput = Ui.input(
            this,
            getString(R.string.name_hint),
            InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS
        );
        nameInput.setText(store.getString(KEY_PROFILE_NAME, ""));
        card.addView(nameInput);
        card.addView(Ui.space(this, 18));
        card.addView(Ui.label(this, getString(R.string.gender_label)));
        card.addView(Ui.space(this, 6));

        RadioGroup gender = new RadioGroup(this);
        gender.setOrientation(RadioGroup.VERTICAL);
        RadioButton female = radio(getString(R.string.gender_female), "female");
        RadioButton male = radio(getString(R.string.gender_male), "male");
        RadioButton privateOption = radio(getString(R.string.gender_private), "prefer_not_to_say");
        gender.addView(female);
        gender.addView(male);
        gender.addView(privateOption);
        String savedGender = store.getString(KEY_PROFILE_GENDER, "female");
        if ("male".equals(savedGender)) {
            male.setChecked(true);
        } else if ("prefer_not_to_say".equals(savedGender)) {
            privateOption.setChecked(true);
        } else {
            female.setChecked(true);
        }
        card.addView(gender);
        card.addView(Ui.space(this, 14));
        card.addView(Ui.divider(this));
        card.addView(Ui.space(this, 14));
        card.addView(Ui.label(this, getString(R.string.location_label)));
        card.addView(Ui.space(this, 8));
        card.addView(Ui.small(this, getString(R.string.fpo_label)));
        content.addView(card);

        content.addView(Ui.space(this, 18));
        Button save = Ui.primaryButton(this, getString(R.string.save_profile));
        save.setOnClickListener(view -> {
            String name = nameInput.getText().toString().trim();
            if (name.isBlank()) {
                nameInput.setError(getString(R.string.name_required));
                return;
            }
            RadioButton selected = findViewById(gender.getCheckedRadioButtonId());
            String genderCode = selected == null ? "prefer_not_to_say" : String.valueOf(selected.getTag());
            store.putString(KEY_PROFILE_NAME, name);
            store.putString(KEY_PROFILE_GENDER, genderCode);
            showHome();
        });
        content.addView(save);
        setContentView(page.root());
    }

    private void showHome() {
        Ui.Page page = Ui.page(this);
        LinearLayout content = page.content();
        addBrandHeader(content, BuildConfig.PILOT_DEMO_MODE);
        content.addView(Ui.space(this, 26));
        String farmerName = store.getString(KEY_PROFILE_NAME, getString(R.string.brand_name));
        content.addView(Ui.title(this, getString(R.string.hello_farmer, farmerName)));
        content.addView(Ui.space(this, 5));
        content.addView(Ui.body(this, getString(R.string.home_subtitle)));
        content.addView(Ui.space(this, 20));

        LinearLayout landCard = Ui.card(this);
        landCard.addView(Ui.label(this, getString(R.string.total_land)));
        landCard.addView(Ui.space(this, 4));
        landCard.addView(Ui.metric(this, getString(R.string.acres_value)));
        landCard.addView(Ui.space(this, 8));
        landCard.addView(Ui.small(this, getString(R.string.location_label)));
        content.addView(landCard);

        content.addView(Ui.space(this, 22));
        content.addView(Ui.sectionTitle(this, getString(R.string.crop_plan)));
        content.addView(Ui.space(this, 10));
        LinearLayout cropCard = Ui.card(this);
        for (int i = 0; i < PilotContract.PILOT_CROPS.size(); i += 1) {
            PilotContract.CropAllocation crop = PilotContract.PILOT_CROPS.get(i);
            cropCard.addView(cropRow(crop));
            if (i < PilotContract.PILOT_CROPS.size() - 1) {
                cropCard.addView(Ui.space(this, 14));
            }
        }
        content.addView(cropCard);

        content.addView(Ui.space(this, 22));
        content.addView(statusRow());
        content.addView(Ui.space(this, 24));
        content.addView(Ui.sectionTitle(this, getString(R.string.quick_actions)));
        content.addView(Ui.space(this, 10));

        Button farm = Ui.primaryButton(this, getString(R.string.view_farm));
        farm.setOnClickListener(view -> showFarm());
        content.addView(farm);
        content.addView(Ui.space(this, 10));
        Button consent = Ui.secondaryButton(this, getString(R.string.manage_consent));
        consent.setOnClickListener(view -> showConsentCenter());
        content.addView(consent);
        content.addView(Ui.space(this, 10));
        Button profile = Ui.secondaryButton(this, getString(R.string.edit_profile));
        profile.setOnClickListener(view -> showProfile(true));
        content.addView(profile);
        content.addView(Ui.space(this, 10));
        Button signOut = Ui.textButton(this, getString(R.string.sign_out));
        signOut.setOnClickListener(view -> confirmSignOut());
        content.addView(signOut);
        content.addView(Ui.space(this, 18));
        content.addView(Ui.small(this, getString(R.string.contract_footer)));
        setContentView(page.root());
    }

    private void showFarm() {
        Ui.Page page = Ui.page(this);
        LinearLayout content = page.content();
        addBackHeader(content, this::showHome);
        content.addView(Ui.space(this, 18));
        content.addView(Ui.title(this, getString(R.string.farm_title)));
        content.addView(Ui.space(this, 8));
        content.addView(Ui.body(this, getString(R.string.farm_body)));
        content.addView(Ui.space(this, 18));

        LinearLayout card = Ui.card(this);
        card.addView(Ui.metric(this, getString(R.string.acres_value)));
        card.addView(Ui.space(this, 14));
        for (PilotContract.CropAllocation crop : PilotContract.PILOT_CROPS) {
            card.addView(cropRow(crop));
            card.addView(Ui.space(this, 12));
        }
        card.addView(Ui.pill(this, getString(R.string.self_reported), true));
        content.addView(card);

        content.addView(Ui.space(this, 16));
        String savedAt = store.getString(KEY_DRAFT_SAVED_AT, "");
        TextView syncStatus = Ui.small(
            this,
            savedAt.isBlank() ? getString(R.string.not_saved) : getString(R.string.last_saved, formatTime(savedAt))
        );
        content.addView(syncStatus);
        content.addView(Ui.space(this, 14));
        Button saveOffline = Ui.primaryButton(this, getString(R.string.save_offline));
        saveOffline.setOnClickListener(view -> {
            String now = Instant.now().toString();
            store.putString(KEY_DRAFT_SAVED_AT, now);
            syncStatus.setText(getString(R.string.last_saved, formatTime(now)));
            toast(R.string.offline_saved);
        });
        content.addView(saveOffline);
        content.addView(Ui.space(this, 10));
        Button verify = Ui.secondaryButton(this, getString(R.string.request_land_check));
        verify.setOnClickListener(view -> showInfo(
            getString(R.string.farm_status),
            getString(R.string.verification_needs_api)
        ));
        content.addView(verify);
        setContentView(page.root());
    }

    private void showConsentCenter() {
        Ui.Page page = Ui.page(this);
        LinearLayout content = page.content();
        addBackHeader(content, this::showHome);
        content.addView(Ui.space(this, 18));
        content.addView(Ui.title(this, getString(R.string.consent_center_title)));
        content.addView(Ui.space(this, 18));

        LinearLayout baseline = Ui.card(this);
        baseline.addView(Ui.sectionTitle(this, getString(R.string.baseline_active)));
        baseline.addView(Ui.space(this, 8));
        baseline.addView(Ui.small(this, BuildConfig.CONSENT_CONTRACT_VERSION));
        baseline.addView(Ui.space(this, 4));
        baseline.addView(Ui.small(this, BuildConfig.BASELINE_POLICY_VERSION));
        baseline.addView(Ui.space(this, 12));
        baseline.addView(Ui.pill(this, getString(R.string.receipt_pending), true));
        content.addView(baseline);

        content.addView(Ui.space(this, 22));
        content.addView(Ui.sectionTitle(this, getString(R.string.optional_permissions)));
        content.addView(Ui.space(this, 8));
        content.addView(Ui.body(this, getString(R.string.optional_unavailable)));
        content.addView(Ui.space(this, 14));
        content.addView(optionalPurposeCard("భూమి రికార్డు ధృవీకరణ", "tg_bhu_bharati"));
        content.addView(Ui.space(this, 10));
        content.addView(optionalPurposeCard("FPO సభ్యత్వ ధృవీకరణ", "fpo_membership_register"));
        content.addView(Ui.space(this, 10));
        content.addView(optionalPurposeCard("వ్యవసాయ సలహా", "agronomic_advisory"));
        content.addView(Ui.space(this, 22));

        Button withdraw = Ui.secondaryButton(this, getString(R.string.withdraw_consent));
        withdraw.setTextColor(Color.rgb(166, 49, 49));
        withdraw.setOnClickListener(view -> confirmWithdrawConsent());
        content.addView(withdraw);
        setContentView(page.root());
    }

    private LinearLayout cropRow(PilotContract.CropAllocation crop) {
        LinearLayout wrapper = Ui.vertical(this);
        LinearLayout labels = Ui.horizontal(this);
        TextView name = Ui.label(this, crop.teluguName());
        name.setLayoutParams(Ui.weighted(1));
        labels.addView(name);
        TextView acres = Ui.label(this, getString(R.string.acres_format, crop.areaAcres().toPlainString()));
        acres.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        acres.setGravity(Gravity.END);
        labels.addView(acres);
        wrapper.addView(labels);
        wrapper.addView(Ui.space(this, 7));

        LinearLayout bar = Ui.horizontal(this);
        bar.setBackground(Ui.rounded(Ui.GREEN_100, Ui.GREEN_100, Ui.dp(this, 8), 0));
        bar.setClipToOutline(true);
        bar.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            Ui.dp(this, 9)
        ));
        View fill = new View(this);
        fill.setBackgroundColor(Ui.GREEN_500);
        int filled = crop.areaAcres().multiply(BigDecimal.TEN).intValue();
        int remaining = PilotContract.PILOT_TOTAL_ACRES.subtract(crop.areaAcres())
            .multiply(BigDecimal.TEN)
            .intValue();
        bar.addView(fill, new LinearLayout.LayoutParams(0, Ui.dp(this, 9), filled));
        View empty = new View(this);
        bar.addView(empty, new LinearLayout.LayoutParams(0, Ui.dp(this, 9), remaining));
        wrapper.addView(bar);
        return wrapper;
    }

    private LinearLayout statusRow() {
        LinearLayout row = Ui.horizontal(this);
        LinearLayout farm = miniStatusCard(
            getString(R.string.farm_status),
            getString(R.string.self_reported),
            true
        );
        farm.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        row.addView(farm);

        View gap = new View(this);
        gap.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, 10), 1));
        row.addView(gap);

        LinearLayout membership = miniStatusCard(
            getString(R.string.membership_status),
            getString(R.string.verification_pending),
            true
        );
        membership.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        row.addView(membership);
        return row;
    }

    private LinearLayout miniStatusCard(String title, String status, boolean warning) {
        LinearLayout card = Ui.card(this);
        card.setPadding(Ui.dp(this, 14), Ui.dp(this, 14), Ui.dp(this, 14), Ui.dp(this, 14));
        card.addView(Ui.small(this, title));
        card.addView(Ui.space(this, 6));
        card.addView(Ui.label(this, status));
        if (warning) {
            card.addView(Ui.space(this, 9));
            TextView marker = Ui.small(this, "● పెండింగ్");
            marker.setTextColor(Ui.WARNING);
            card.addView(marker);
        }
        return card;
    }

    private LinearLayout optionalPurposeCard(String title, String adapter) {
        LinearLayout card = Ui.card(this);
        card.setPadding(Ui.dp(this, 15), Ui.dp(this, 15), Ui.dp(this, 15), Ui.dp(this, 15));
        card.addView(Ui.label(this, title));
        card.addView(Ui.space(this, 4));
        card.addView(Ui.small(this, adapter));
        card.addView(Ui.space(this, 8));
        card.addView(Ui.pill(this, getString(R.string.verification_pending), true));
        return card;
    }

    private void addBrandHeader(LinearLayout content, boolean demo) {
        LinearLayout header = Ui.horizontal(this);
        TextView brand = Ui.brand(this);
        brand.setLayoutParams(Ui.weighted(1));
        header.addView(brand);
        header.addView(Ui.pill(
            this,
            demo ? getString(R.string.demo_badge) : getString(R.string.pilot_badge),
            demo
        ));
        content.addView(header);
        content.addView(Ui.space(this, 5));
        content.addView(Ui.small(this, getString(R.string.brand_tagline)));
    }

    private void addBackHeader(LinearLayout content, Runnable backAction) {
        if (backAction == null) {
            addBrandHeader(content, BuildConfig.PILOT_DEMO_MODE);
            return;
        }
        LinearLayout header = Ui.horizontal(this);
        Button back = Ui.textButton(this, "← " + getString(R.string.back));
        back.setLayoutParams(Ui.weighted(1));
        back.setOnClickListener(view -> backAction.run());
        header.addView(back);
        header.addView(Ui.pill(this, getString(R.string.pilot_badge), false));
        content.addView(header);
    }

    private CheckBox consentCheckBox(String text) {
        CheckBox checkBox = new CheckBox(this);
        checkBox.setText(text);
        checkBox.setTextColor(Ui.TEXT);
        checkBox.setTextSize(15);
        checkBox.setGravity(Gravity.CENTER_VERTICAL);
        checkBox.setPadding(0, Ui.dp(this, 6), 0, Ui.dp(this, 6));
        checkBox.setButtonTintList(android.content.res.ColorStateList.valueOf(Ui.GREEN_700));
        checkBox.setLayoutParams(Ui.matchWrap(this));
        return checkBox;
    }

    private RadioButton radio(String text, String value) {
        RadioButton button = new RadioButton(this);
        button.setId(View.generateViewId());
        button.setText(text);
        button.setTag(value);
        button.setTextColor(Ui.TEXT);
        button.setTextSize(15);
        button.setButtonTintList(android.content.res.ColorStateList.valueOf(Ui.GREEN_700));
        return button;
    }

    private void confirmSignOut() {
        new AlertDialog.Builder(this)
            .setTitle(getString(R.string.sign_out))
            .setMessage("ఈ పరికరంలోని పైలట్ సెషన్ మరియు స్థానిక వివరాలు తొలగించబడతాయి.")
            .setNegativeButton(getString(R.string.cancel), null)
            .setPositiveButton(getString(R.string.sign_out), (dialog, which) -> clearLocalSession())
            .show();
    }

    private void confirmWithdrawConsent() {
        new AlertDialog.Builder(this)
            .setTitle(getString(R.string.withdraw_title))
            .setMessage(getString(R.string.withdraw_body))
            .setNegativeButton(getString(R.string.cancel), null)
            .setPositiveButton(getString(R.string.confirm_withdraw), (dialog, which) -> clearLocalSession())
            .show();
    }

    private void clearLocalSession() {
        store.clear();
        pendingPhone = null;
        showLogin();
    }

    private void showInfo(String title, String message) {
        new AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton("సరే", null)
            .show();
    }

    private void toast(int stringResource) {
        Toast.makeText(this, stringResource, Toast.LENGTH_LONG).show();
    }

    private String formatTime(String instant) {
        try {
            DateTimeFormatter formatter = DateTimeFormatter
                .ofPattern("dd-MM-yyyy HH:mm", Locale.forLanguageTag(PilotContract.PRIMARY_LOCALE))
                .withZone(ZoneId.systemDefault());
            return formatter.format(Instant.parse(instant));
        } catch (Exception ignored) {
            return instant;
        }
    }
}
