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
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.UUID;

public final class MainActivity extends Activity {
    private enum NavSection { DASHBOARD, FARM, INTELLIGENCE, TRAINING, MORE }

    private static final String UI_PREFERENCES = "agrivah_ui_preferences";
    private static final String KEY_LANGUAGE = "language";
    private static final String KEY_SESSION = "session_active";
    private static final String KEY_PHONE_MASKED = "phone_masked";
    private static final String KEY_CONSENT = "baseline_consent_active";
    private static final String KEY_RECEIPT = "baseline_consent_receipt";
    private static final String KEY_PROFILE_NAME = "profile_name";
    private static final String KEY_PROFILE_GENDER = "profile_gender";
    private static final String KEY_SNAPSHOT_VERSION = "profile_snapshot_version";
    private static final String KEY_DRAFT_SAVED_AT = "draft_saved_at";

    private static final String DEMO_OTP = "123456";

    private SecureStore store;
    private String pendingPhone;
    private String languageCode = "te";

    @Override
    protected void attachBaseContext(Context newBase) {
        String selectedLanguage = newBase.getSharedPreferences(UI_PREFERENCES, Context.MODE_PRIVATE)
            .getString(KEY_LANGUAGE, "te");
        Locale locale = Locale.forLanguageTag(selectedLanguage + "-IN");
        Locale.setDefault(locale);
        Configuration configuration = new Configuration(newBase.getResources().getConfiguration());
        configuration.setLocale(locale);
        super.attachBaseContext(newBase.createConfigurationContext(configuration));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        store = new SecureStore(this);
        languageCode = getSharedPreferences(UI_PREFERENCES, Context.MODE_PRIVATE)
            .getString(KEY_LANGUAGE, "te");
        if (BuildConfig.PILOT_DEMO_MODE && store.getBoolean(KEY_SESSION, false)) {
            applyPilotSnapshot();
        }
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
            applyPilotSnapshot();
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
        card.addView(Ui.label(this, getString(R.string.app_language)));
        card.addView(Ui.space(this, 6));
        RadioGroup language = new RadioGroup(this);
        language.setOrientation(RadioGroup.VERTICAL);
        RadioButton telugu = radio("తెలుగు", "te");
        RadioButton hindi = radio("हिन्दी", "hi");
        RadioButton tamil = radio("தமிழ்", "ta");
        RadioButton english = radio("English", "en");
        language.addView(telugu);
        language.addView(hindi);
        language.addView(tamil);
        language.addView(english);
        if ("hi".equals(languageCode)) {
            hindi.setChecked(true);
        } else if ("ta".equals(languageCode)) {
            tamil.setChecked(true);
        } else if ("en".equals(languageCode)) {
            english.setChecked(true);
        } else {
            telugu.setChecked(true);
        }
        card.addView(language);
        card.addView(Ui.space(this, 14));
        card.addView(Ui.divider(this));
        card.addView(Ui.space(this, 14));
        card.addView(Ui.label(this, getString(R.string.location_label)));
        card.addView(Ui.space(this, 8));
        card.addView(Ui.small(this, getString(R.string.fpo_label)));
        content.addView(card);

        content.addView(Ui.space(this, 16));
        content.addView(snapshotGroup(text("వెబ్ ప్రొఫైల్ వివరాలు", "वेब प्रोफ़ाइल विवरण", "வலை சுயவிவர விவரங்கள்", "Web profile details"), PilotContract.PROFILE_DETAILS));
        content.addView(Ui.space(this, 16));
        content.addView(snapshotGroup(text("పత్రాలు", "दस्तावेज़", "ஆவணங்கள்", "Documents"), PilotContract.PROFILE_DOCUMENTS));

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
            RadioButton selectedLanguage = findViewById(language.getCheckedRadioButtonId());
            String newLanguage = selectedLanguage == null ? "te" : String.valueOf(selectedLanguage.getTag());
            getSharedPreferences(UI_PREFERENCES, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_LANGUAGE, newLanguage)
                .apply();
            if (!newLanguage.equals(languageCode)) {
                recreate();
            } else {
                showHome();
            }
        });
        content.addView(save);
        if (fromHome) {
            setAppPage(page, NavSection.MORE);
        } else {
            setContentView(page.root());
        }
    }

    private void showHome() {
        Ui.Page page = Ui.page(this);
        LinearLayout content = page.content();
        addBrandHeader(content, BuildConfig.PILOT_DEMO_MODE);
        content.addView(Ui.space(this, 18));
        String farmerName = store.getString(KEY_PROFILE_NAME, getString(R.string.brand_name));
        content.addView(Ui.title(this, getString(R.string.hello_farmer, farmerName)));
        content.addView(Ui.space(this, 5));
        content.addView(Ui.body(this, getString(R.string.kaza_cluster_guntur)));
        content.addView(Ui.space(this, 16));

        LinearLayout metrics = Ui.horizontal(this);
        metrics.addView(dashboardMetricCard("▣", "18.20", getString(R.string.acres_short), this::showFarm), Ui.weighted(1));
        metrics.addView(horizontalGap(8));
        metrics.addView(dashboardMetricCard("♧", "3", getString(R.string.crops_short), this::showFarm), Ui.weighted(1));
        metrics.addView(horizontalGap(8));
        metrics.addView(dashboardMetricCard("▤", "0/12", getString(R.string.lessons_short), this::showTraining), Ui.weighted(1));
        content.addView(metrics);

        content.addView(Ui.space(this, 16));
        content.addView(weatherDashboardCard());

        content.addView(Ui.space(this, 14));
        LinearLayout warning = Ui.card(this);
        warning.setBackground(Ui.rounded(Ui.WARNING_BG, Ui.WARNING_BG, Ui.dp(this, 20), 0));
        TextView warningTitle = Ui.sectionTitle(this, "⚠  " + getString(R.string.rain_alert));
        warningTitle.setTextColor(Ui.WARNING);
        warning.addView(warningTitle);
        warning.addView(Ui.space(this, 6));
        warning.addView(Ui.body(this, getString(R.string.rain_alert_body)));
        warning.setOnClickListener(view -> showIntelligence());
        content.addView(warning);

        content.addView(Ui.space(this, 18));
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

        content.addView(Ui.space(this, 12));
        content.addView(Ui.small(this, getString(R.string.synthetic_weather_note)));
        setAppPage(page, NavSection.DASHBOARD);
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
            card.addView(Ui.space(this, 5));
            card.addView(Ui.small(this, getString(
                R.string.parcel_details,
                crop.parcelName(),
                crop.plotReference(),
                crop.centroid()
            )));
            card.addView(Ui.space(this, 12));
        }
        card.addView(Ui.small(this, getString(R.string.farm_metadata)));
        card.addView(Ui.space(this, 8));
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
        setAppPage(page, NavSection.FARM);
    }

    private void showMore() {
        Ui.Page page = Ui.page(this);
        LinearLayout content = page.content();
        addBrandHeader(content, BuildConfig.PILOT_DEMO_MODE);
        content.addView(Ui.space(this, 16));

        LinearLayout profile = Ui.card(this);
        profile.addView(Ui.sectionTitle(this, store.getString(KEY_PROFILE_NAME, PilotContract.SNAPSHOT_FARMER_NAME)));
        profile.addView(Ui.space(this, 4));
        profile.addView(Ui.small(this, getString(R.string.farmer_workspace_synthetic)));
        content.addView(profile);
        content.addView(Ui.space(this, 18));
        content.addView(Ui.title(this, getString(R.string.all_services)));
        content.addView(Ui.space(this, 12));

        addMoreRow(content,
            moreTile("▣", getString(R.string.service_profile), getString(R.string.service_profile_subtitle), () -> showProfile(true)),
            moreTile("✓", getString(R.string.service_onboarding), getString(R.string.service_onboarding_subtitle), this::showOnboarding));
        addMoreRow(content,
            moreTile("↶", getString(R.string.service_history), getString(R.string.service_history_subtitle), this::showFarmHistory),
            moreTile("✚", getString(R.string.service_inputs), getString(R.string.service_inputs_subtitle), this::showInputs));
        addMoreRow(content,
            moreTile("♧", getString(R.string.service_soil), getString(R.string.service_soil_subtitle), this::showSoilCare),
            moreTile("▤", getString(R.string.service_schemes), getString(R.string.service_schemes_subtitle), this::showSchemes));
        addMoreRow(content,
            moreTile("▰", getString(R.string.service_market), getString(R.string.service_market_subtitle), this::showMarketplace),
            moreTile("◇", getString(R.string.service_consent), getString(R.string.service_consent_subtitle), this::showConsentCenter));

        content.addView(Ui.space(this, 8));
        Button signOut = Ui.textButton(this, getString(R.string.sign_out));
        signOut.setTextColor(Color.rgb(166, 49, 49));
        signOut.setOnClickListener(view -> confirmSignOut());
        content.addView(signOut);
        setAppPage(page, NavSection.MORE);
    }

    private void showOnboarding() {
        showSnapshotScreen(
            text("నా ఆన్‌బోర్డింగ్", "मेरा ऑनबोर्डिंग", "என் சேர்க்கை", "My onboarding"),
            text("వెబ్‌లో ఉన్న పాత్ర దరఖాస్తులు మరియు ప్రస్తుత స్థితి.", "वेब पर भूमिका आवेदन और उनकी वर्तमान स्थिति।", "வலையில் உள்ள பங்கு விண்ணப்பங்களும் தற்போதைய நிலையும்.", "Role applications and their current web status."),
            PilotContract.ONBOARDING_APPLICATIONS,
            text("ఆరు దరఖాస్తులు డ్రాఫ్ట్‌లో ఉన్నాయి; ఏదీ సమర్పించబడలేదు.", "छह आवेदन ड्राफ्ट में हैं; कोई जमा नहीं हुआ।", "ஆறு விண்ணப்பங்கள் வரைவில் உள்ளன; எதுவும் சமர்ப்பிக்கப்படவில்லை.", "Six applications are in draft; none has been submitted."),
            NavSection.MORE
        );
    }

    private void showFarmHistory() {
        Ui.Page page = Ui.page(this);
        LinearLayout content = page.content();
        addBackHeader(content, this::showHome);
        addPageIntro(content, "B2A · MY FARM HISTORY",
            text("పొలం చరిత్ర", "खेत इतिहास", "பண்ணை வரலாறு", "Farm history"),
            text("2022–2026 సింథటిక్ రైతు రికార్డులు; ఖర్చు, దిగుబడి, ధర మరియు ఆదాయం.", "2022–2026 सिंथेटिक किसान रिकॉर्ड: लागत, उपज, मूल्य और आय।", "2022–2026 செயற்கை விவசாயி பதிவுகள்: செலவு, விளைச்சல், விலை மற்றும் வருவாய்.", "Synthetic 2022–2026 farmer records: cost, yield, price and revenue."));

        for (PilotContract.FarmHistoryItem item : PilotContract.FARM_HISTORY) {
            LinearLayout card = Ui.card(this);
            card.addView(Ui.small(this, item.season()));
            card.addView(Ui.space(this, 3));
            card.addView(Ui.sectionTitle(this, item.crop() + " • " + item.acres()));
            card.addView(Ui.space(this, 9));
            card.addView(Ui.body(this, text("ఖర్చు", "लागत", "செலவு", "Cost") + " " + item.cost()
                + "  •  " + text("దిగుబడి", "उपज", "விளைச்சல்", "Yield") + " " + item.yieldAmount()));
            card.addView(Ui.body(this, text("ధర", "मूल्य", "விலை", "Price") + " " + item.price()
                + "  •  " + text("ఆదాయం", "आय", "வருவாய்", "Revenue") + " " + item.revenue()));
            card.addView(Ui.space(this, 7));
            card.addView(Ui.small(this, item.note()));
            content.addView(card);
            content.addView(Ui.space(this, 12));
        }

        content.addView(snapshotGroup(text("బీమా చరిత్ర", "बीमा इतिहास", "காப்பீட்டு வரலாறு", "Insurance history"), PilotContract.INSURANCE_SNAPSHOTS));
        content.addView(Ui.space(this, 8));
        content.addView(Ui.small(this, "Sunrise FPO channel desk — PMFBY enrolment (synthetic)"));
        setAppPage(page, NavSection.FARM);
    }

    private void showIntelligence() {
        showSnapshotScreen(
            text("పొలం సమాచారం", "खेत की जानकारी", "பண்ணை தகவல்", "Farm intelligence"),
            text("స్థానం, వాతావరణం, నేల, పంట ప్రణాళిక, మార్కెట్, విలువ జోడింపు, ఫలిత ప్రణాళిక మరియు సమీప సహాయం.", "स्थान, मौसम, मिट्टी, फसल योजना, बाज़ार, मूल्य-वर्धन, परिणाम योजना और नज़दीकी सहायता।", "இடம், வானிலை, மண், பயிர்த் திட்டம், சந்தை, மதிப்பூட்டல், விளைவு திட்டம் மற்றும் அருகிலுள்ள உதவி.", "Location, weather, soil, crop planning, market, value-add, outcome planning and nearby help."),
            PilotContract.INTELLIGENCE_SECTIONS,
            text("పరిశీలించిన, అంచనా లేదా ఉత్పన్న లేబుళ్లను గమనించండి. మార్కెట్ ధరలు సింథటిక్ పరిశీలనలు; ఇతర వివరాలు ఉత్పన్న/సూచన డేటా.", "देखा गया, पूर्वानुमान या व्युत्पन्न लेबल देखें। बाज़ार मूल्य सिंथेटिक अवलोकन हैं; अन्य विवरण व्युत्पन्न/संदर्भ डेटा हैं।", "கவனிக்கப்பட்டது, முன்னறிவிப்பு அல்லது பெறப்பட்டது என்ற குறிச்சொற்களைப் பார்க்கவும். சந்தை விலைகள் செயற்கை கண்காணிப்புகள்; மற்றவை பெறப்பட்ட/குறிப்பு தரவு.", "Note OBSERVED, FORECAST or DERIVED labels. Market prices are synthetic observations; other details are derived/reference data."),
            NavSection.INTELLIGENCE
        );
    }

    private void showTraining() {
        Ui.Page page = Ui.page(this);
        LinearLayout content = page.content();
        addBackHeader(content, this::showHome);
        addPageIntro(content, "B2B · FARMER PRACTICE LIBRARY",
            text("రైతు శిక్షణ", "किसान प्रशिक्षण", "விவசாயி பயிற்சி", "Farmer training"),
            text("విత్తడం నుంచి విలువ సృష్టి వరకు దశల వారీ మార్గదర్శనం. పూర్తి చేసిన పాఠాన్ని గుర్తించండి.", "बुवाई से मूल्य निर्माण तक चरणबद्ध मार्गदर्शन। पूरा पाठ चिह्नित करें।", "விதைப்பிலிருந்து மதிப்பூட்டல் வரை படிப்படியான வழிகாட்டல். முடித்த பாடத்தைக் குறிக்கவும்.", "Step-by-step guidance from sowing to value creation. Mark completed lessons."));

        for (PilotContract.TrainingModule module : PilotContract.TRAINING_MODULES) {
            LinearLayout card = Ui.card(this);
            TextView stage = Ui.small(this, module.stage());
            stage.setTextColor(Ui.GREEN_700);
            card.addView(stage);
            card.addView(Ui.space(this, 5));
            card.addView(Ui.sectionTitle(this, module.title()));
            card.addView(Ui.space(this, 7));
            card.addView(Ui.body(this, module.summary()));
            card.addView(Ui.space(this, 10));
            card.addView(Ui.divider(this));
            TextView progress = Ui.small(this, "0/" + module.lessons().size() + " "
                + text("పూర్తి", "पूर्ण", "முடிந்தது", "completed") + " • "
                + text("ప్రగతిలో", "प्रगति में", "செயலில்", "in progress"));
            int[] completed = {0};
            for (String lesson : module.lessons()) {
                CheckBox check = consentCheckBox(lesson);
                check.setOnCheckedChangeListener((button, checked) -> {
                    completed[0] += checked ? 1 : -1;
                    progress.setText(completed[0] + "/" + module.lessons().size() + " "
                        + text("పూర్తి", "पूर्ण", "முடிந்தது", "completed") + " • "
                        + (completed[0] == module.lessons().size()
                            ? text("పూర్తయింది", "पूरा", "நிறைவு", "complete")
                            : text("ప్రగతిలో", "प्रगति में", "செயலில்", "in progress")));
                });
                card.addView(check);
            }
            card.addView(Ui.space(this, 7));
            card.addView(progress);
            content.addView(card);
            content.addView(Ui.space(this, 12));
        }
        content.addView(Ui.small(this, text(
            "ఈ పైలట్ బిల్డ్‌లో పూర్తి చేసిన పాఠాల మార్పులు పరికరం-స్థాయి మాత్రమే; బ్యాక్‌ఎండ్ సమకాలీకరణ ఇంకా అమలు కాలేదు.",
            "इस पायलट में पाठ पूर्णता केवल डिवाइस पर रहती है; बैकएंड समन्वयन अभी लागू नहीं है।",
            "இந்த முன்னோட்டத்தில் பாட நிறைவு சாதனத்தில் மட்டுமே சேமிக்கப்படும்; பின்தள ஒத்திசைவு இன்னும் இல்லை.",
            "Lesson completion is device-only in this pilot; backend sync is not yet implemented."
        )));
        setAppPage(page, NavSection.TRAINING);
    }

    private void showInputs() {
        showSnapshotScreen(
            text("ఇన్‌పుట్స్ & రక్షణ", "इनपुट और सुरक्षा", "இடுபொருட்கள் & பாதுகாப்பு", "Inputs & protection"),
            text("వరి, మిరప మరియు పత్తి కోసం పోషకాలు మరియు రక్షణ మార్గదర్శనం.", "धान, मिर्च और कपास के लिए पोषण और सुरक्षा मार्गदर्शन।", "நெல், மிளகாய் மற்றும் பருத்திக்கான ஊட்டச்சத்து மற்றும் பாதுகாப்பு வழிகாட்டல்.", "Nutrient and protection guidance for Paddy, Chilli and Cotton."),
            PilotContract.INPUT_GUIDANCE,
            text("మోతాదులు హెక్టారుకు సూచన విలువలు. నేల పరీక్ష, పంట దశ, స్థానిక లేబుల్ మరియు అధీకృత నిపుణుడి నిర్ణయం లేకుండా ఉపయోగించవద్దు.", "मात्राएँ प्रति हेक्टेयर संदर्भ मान हैं। मिट्टी परीक्षण, फसल अवस्था, स्थानीय लेबल और अधिकृत विशेषज्ञ के निर्णय के बिना उपयोग न करें।", "அளவுகள் ஹெக்டேருக்கான குறிப்புகள். மண் பரிசோதனை, பயிர் நிலை, உள்ளூர் லேபிள் மற்றும் அங்கீகரிக்கப்பட்ட நிபுணர் முடிவு இல்லாமல் பயன்படுத்த வேண்டாம்.", "Rates are per-hectare reference values. Do not apply without a soil test, crop-stage check, local label and authorised expert decision."),
            NavSection.MORE
        );
    }

    private void showSoilCare() {
        showSnapshotScreen(
            text("నేల సంరక్షణ", "मृदा देखभाल", "மண் பராமரிப்பு", "Soil care"),
            text("వెబ్ నేల సంరక్షణ జాబితాలోని ఎనిమిది నిలుపుదల పద్ధతులు.", "वेब मृदा-देखभाल सूची की आठ संरक्षण विधियाँ।", "வலை மண் பராமரிப்பு பட்டியலில் உள்ள எட்டு பாதுகாப்பு முறைகள்.", "Eight retention practices from the web soil-care catalogue."),
            PilotContract.SOIL_PRACTICES,
            text("జిప్సం లేదా సున్నం వంటి సవరణలకు నేల ప్రయోగశాల ఫలితం తప్పనిసరి.", "जिप्सम या चूना जैसे संशोधनों के लिए मिट्टी प्रयोगशाला परिणाम अनिवार्य है।", "ஜிப்சம் அல்லது சுண்ணாம்பு போன்ற திருத்தங்களுக்கு மண் ஆய்வு முடிவு அவசியம்.", "A soil-lab result is mandatory before amendments such as gypsum or lime."),
            NavSection.MORE
        );
    }

    private void showSchemes() {
        showSnapshotScreen(
            text("పథకాలు", "योजनाएँ", "திட்டங்கள்", "Schemes"),
            text("వెబ్ పథకాల జాబితా మరియు రైతు దరఖాస్తు స్థితి.", "वेब योजना सूची और किसान आवेदन स्थिति।", "வலைத் திட்டப் பட்டியலும் விவசாயியின் விண்ணப்ப நிலையும்.", "Web scheme catalogue and farmer application status."),
            PilotContract.SCHEMES,
            text("అర్హత తనిఖీలు సింథటిక్/ప్రాథమికం మాత్రమే; ప్రభుత్వ అర్హత లేదా ఆమోదంగా పరిగణించవద్దు.", "पात्रता जाँच केवल सिंथेटिक/प्रारंभिक है; इसे सरकारी पात्रता या स्वीकृति न मानें।", "தகுதிச் சரிபார்ப்புகள் செயற்கை/ஆரம்ப நிலை மட்டுமே; அரசு தகுதி அல்லது ஒப்புதலாக கருத வேண்டாம்.", "Eligibility checks are synthetic/preliminary and are not government eligibility or approval."),
            NavSection.MORE
        );
    }

    private void showMarketplace() {
        showSnapshotScreen(
            text("మార్కెట్‌ప్లేస్", "मार्केटप्लेस", "சந்தை", "Marketplace"),
            text("రైతు మార్కెట్ ప్రొఫైల్, జాబితాలు, ధర అభ్యర్థనలు, కోట్స్, ఆర్డర్లు మరియు వివాదాలు.", "किसान बाज़ार प्रोफ़ाइल, सूचियाँ, मूल्य अनुरोध, कोट, ऑर्डर और विवाद।", "விவசாயி சந்தை சுயவிவரம், பட்டியல்கள், விலை கோரிக்கைகள், மேற்கோள்கள், ஆர்டர்கள் மற்றும் சர்ச்சைகள்.", "Farmer marketplace profile, listings, RFQs, quotes, orders and disputes."),
            PilotContract.MARKETPLACE_STATE,
            text("ప్రస్తుత వెబ్ రైతు ఖాతాలో మార్కెట్ కార్యకలాపం లేదు; మొబైల్ యాప్ కూడా ఖాళీ స్థితినే చూపుతుంది.", "वर्तमान वेब किसान खाते में बाज़ार गतिविधि नहीं है; मोबाइल ऐप भी खाली स्थिति दिखाता है।", "தற்போதைய வலை விவசாயி கணக்கில் சந்தைச் செயல்பாடு இல்லை; கைபேசி செயலியும் காலியான நிலையைக் காட்டுகிறது.", "The current web farmer account has no marketplace activity; the mobile app shows the same empty state."),
            NavSection.MORE
        );
    }

    private void showSnapshotScreen(String title, String subtitle,
                                    java.util.List<PilotContract.SnapshotItem> items,
                                    String footer, NavSection activeSection) {
        Ui.Page page = Ui.page(this);
        LinearLayout content = page.content();
        addBackHeader(content, this::showHome);
        addPageIntro(content, "AGRIVAH · WEB PARITY", title, subtitle);
        for (PilotContract.SnapshotItem item : items) {
            content.addView(snapshotCard(item));
            content.addView(Ui.space(this, 12));
        }
        content.addView(Ui.small(this, footer));
        setAppPage(page, activeSection);
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
        content.addView(optionalPurposeCard(text("భూమి రికార్డు ధృవీకరణ", "भूमि रिकॉर्ड सत्यापन", "நிலப் பதிவு சரிபார்ப்பு", "Land-record verification"), "tg_bhu_bharati"));
        content.addView(Ui.space(this, 10));
        content.addView(optionalPurposeCard(text("FPO సభ్యత్వ ధృవీకరణ", "FPO सदस्यता सत्यापन", "FPO உறுப்பினர் சரிபார்ப்பு", "FPO membership verification"), "fpo_membership_register"));
        content.addView(Ui.space(this, 10));
        content.addView(optionalPurposeCard(text("వ్యవసాయ సలహా", "कृषि सलाह", "வேளாண் ஆலோசனை", "Agronomic advice"), "agronomic_advisory"));
        content.addView(Ui.space(this, 22));

        Button withdraw = Ui.secondaryButton(this, getString(R.string.withdraw_consent));
        withdraw.setTextColor(Color.rgb(166, 49, 49));
        withdraw.setOnClickListener(view -> confirmWithdrawConsent());
        content.addView(withdraw);
        setAppPage(page, NavSection.MORE);
    }

    private LinearLayout cropRow(PilotContract.CropAllocation crop) {
        LinearLayout wrapper = Ui.vertical(this);
        LinearLayout labels = Ui.horizontal(this);
        TextView name = Ui.label(this, crop.teluguName() + " / " + crop.englishName());
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

    private View horizontalGap(int widthDp) {
        View gap = new View(this);
        gap.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(this, widthDp), 1));
        return gap;
    }

    private LinearLayout dashboardMetricCard(String icon, String value, String label, Runnable action) {
        LinearLayout card = Ui.card(this);
        card.setPadding(Ui.dp(this, 12), Ui.dp(this, 12), Ui.dp(this, 12), Ui.dp(this, 12));
        TextView iconView = Ui.label(this, icon);
        iconView.setTextColor(Ui.GREEN_700);
        card.addView(iconView);
        card.addView(Ui.space(this, 5));
        TextView valueView = Ui.sectionTitle(this, value);
        valueView.setTextColor(Ui.GREEN_900);
        card.addView(valueView);
        card.addView(Ui.small(this, label));
        card.setOnClickListener(view -> action.run());
        return card;
    }

    private LinearLayout weatherDashboardCard() {
        LinearLayout card = Ui.card(this);
        LinearLayout header = Ui.horizontal(this);
        LinearLayout labels = Ui.vertical(this);
        labels.setLayoutParams(Ui.weighted(1));
        labels.addView(Ui.sectionTitle(this, getString(R.string.seven_day_weather)));
        labels.addView(Ui.small(this, getString(R.string.kaza_synthetic_forecast)));
        header.addView(labels);
        TextView temperature = Ui.metric(this, PilotContract.CURRENT_TEMPERATURE_C + "°");
        temperature.setGravity(Gravity.END);
        header.addView(temperature, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        card.addView(header);
        card.addView(Ui.space(this, 5));
        card.addView(Ui.body(this, getString(R.string.current_weather_conditions)));
        card.addView(Ui.space(this, 8));
        card.addView(Ui.small(this,
            getString(R.string.humidity) + " " + PilotContract.CURRENT_HUMIDITY_PCT + "%   •   "
                + getString(R.string.wind) + " " + PilotContract.CURRENT_WIND_KPH + " km/h   •   "
                + getString(R.string.rain) + " "
                + String.format(Locale.US, "%.1f", PilotContract.CURRENT_RAINFALL_MM) + " mm"));
        card.addView(Ui.space(this, 13));

        HorizontalScrollView scroll = new HorizontalScrollView(this);
        scroll.setHorizontalScrollBarEnabled(false);
        LinearLayout days = Ui.horizontal(this);
        days.setLayoutParams(new HorizontalScrollView.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        LocalDate today = LocalDate.now();
        Locale selectedLocale = Locale.forLanguageTag(languageCode + "-IN");
        DateTimeFormatter dayFormatter = DateTimeFormatter.ofPattern("EEE", selectedLocale);
        DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("dd MMM", selectedLocale);
        for (PilotContract.WeatherDay day : PilotContract.WEATHER_FORECAST) {
            LocalDate date = today.plusDays(day.dayOffset());
            LinearLayout dayCard = Ui.vertical(this);
            dayCard.setPadding(Ui.dp(this, 10), Ui.dp(this, 10), Ui.dp(this, 10), Ui.dp(this, 10));
            dayCard.setBackground(Ui.rounded(Ui.CREAM, Ui.BORDER, Ui.dp(this, 14), Ui.dp(this, 1)));
            dayCard.setGravity(Gravity.CENTER);
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(Ui.dp(this, 96), ViewGroup.LayoutParams.WRAP_CONTENT);
            params.setMarginEnd(Ui.dp(this, 9));
            dayCard.setLayoutParams(params);
            TextView dayLabel = Ui.label(this, dayFormatter.format(date));
            dayLabel.setGravity(Gravity.CENTER);
            dayCard.addView(dayLabel);
            TextView dateLabel = Ui.small(this, dateFormatter.format(date));
            dateLabel.setGravity(Gravity.CENTER);
            dayCard.addView(dateLabel);
            TextView symbol = Ui.title(this, day.symbol());
            symbol.setGravity(Gravity.CENTER);
            dayCard.addView(symbol);
            TextView range = Ui.label(this, day.maximumC() + "° / " + day.minimumC() + "°");
            range.setGravity(Gravity.CENTER);
            dayCard.addView(range);
            TextView rain = Ui.small(this, String.format(Locale.US, "%.1f mm", day.rainfallMm()));
            rain.setTextColor(Color.rgb(35, 111, 178));
            rain.setGravity(Gravity.CENTER);
            dayCard.addView(rain);
            days.addView(dayCard);
        }
        scroll.addView(days);
        card.addView(scroll);
        return card;
    }

    private Button moreTile(String icon, String title, String subtitle, Runnable action) {
        Button button = Ui.secondaryButton(this, icon + "\n" + title + "\n" + subtitle);
        button.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        button.setTextColor(Ui.TEXT);
        button.setMinHeight(Ui.dp(this, 108));
        button.setOnClickListener(view -> action.run());
        return button;
    }

    private void addMoreRow(LinearLayout content, Button left, Button right) {
        LinearLayout row = Ui.horizontal(this);
        row.addView(left, Ui.weighted(1));
        row.addView(horizontalGap(10));
        row.addView(right, Ui.weighted(1));
        content.addView(row);
        content.addView(Ui.space(this, 10));
    }

    private void setAppPage(Ui.Page page, NavSection activeSection) {
        LinearLayout shell = new LinearLayout(this);
        shell.setOrientation(LinearLayout.VERTICAL);
        shell.setBackgroundColor(Ui.CREAM);
        shell.addView(page.root(), new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 0, 1
        ));
        shell.addView(bottomNavigation(activeSection), new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        setContentView(shell);
    }

    private LinearLayout bottomNavigation(NavSection activeSection) {
        LinearLayout navigation = Ui.horizontal(this);
        navigation.setPadding(Ui.dp(this, 8), Ui.dp(this, 7), Ui.dp(this, 8), Ui.dp(this, 5));
        navigation.setBackgroundColor(Color.WHITE);
        navigation.setElevation(Ui.dp(this, 12));
        navigation.addView(navigationButton("▦", getString(R.string.nav_dashboard),
            activeSection == NavSection.DASHBOARD, this::showHome), Ui.weighted(1));
        navigation.addView(navigationButton("▣", getString(R.string.nav_farm),
            activeSection == NavSection.FARM, this::showFarm), Ui.weighted(1));
        navigation.addView(navigationButton("⌁", getString(R.string.nav_intelligence),
            activeSection == NavSection.INTELLIGENCE, this::showIntelligence), Ui.weighted(1));
        navigation.addView(navigationButton("▤", getString(R.string.nav_training),
            activeSection == NavSection.TRAINING, this::showTraining), Ui.weighted(1));
        navigation.addView(navigationButton("•••", getString(R.string.nav_more),
            activeSection == NavSection.MORE, this::showMore), Ui.weighted(1));
        navigation.setOnApplyWindowInsetsListener((view, insets) -> {
            android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars());
            view.setPadding(Ui.dp(this, 8), Ui.dp(this, 7), Ui.dp(this, 8), Ui.dp(this, 5) + bars.bottom);
            return insets;
        });
        return navigation;
    }

    private Button navigationButton(String icon, String title, boolean selected, Runnable action) {
        Button button = new Button(this);
        button.setText(icon + "\n" + title);
        button.setTextSize(10);
        button.setTextColor(selected ? Ui.GREEN_700 : Ui.MUTED);
        button.setGravity(Gravity.CENTER);
        button.setAllCaps(false);
        button.setMinHeight(Ui.dp(this, 58));
        button.setPadding(Ui.dp(this, 2), Ui.dp(this, 4), Ui.dp(this, 2), Ui.dp(this, 4));
        button.setBackground(selected
            ? Ui.rounded(Ui.GREEN_100, Ui.GREEN_100, Ui.dp(this, 13), 0)
            : Ui.rounded(Color.WHITE, Color.WHITE, Ui.dp(this, 13), 0));
        button.setOnClickListener(view -> action.run());
        return button;
    }

    private void addMenuButton(LinearLayout menu, String title, String subtitle, Runnable action) {
        Button button = Ui.textButton(this, title + "\n" + subtitle + "   ›");
        button.setTextSize(16);
        button.setTextColor(Ui.TEXT);
        button.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        button.setPadding(0, Ui.dp(this, 8), 0, Ui.dp(this, 8));
        button.setOnClickListener(view -> action.run());
        menu.addView(button);
        menu.addView(Ui.divider(this));
    }

    private void addPageIntro(LinearLayout content, String eyebrow, String title, String subtitle) {
        content.addView(Ui.space(this, 18));
        TextView label = Ui.small(this, eyebrow);
        label.setTextColor(Ui.GREEN_700);
        content.addView(label);
        content.addView(Ui.space(this, 7));
        content.addView(Ui.title(this, title));
        content.addView(Ui.space(this, 7));
        content.addView(Ui.body(this, subtitle));
        content.addView(Ui.space(this, 18));
    }

    private LinearLayout snapshotGroup(String title, java.util.List<PilotContract.SnapshotItem> items) {
        LinearLayout card = Ui.card(this);
        card.addView(Ui.sectionTitle(this, title));
        card.addView(Ui.space(this, 10));
        for (int i = 0; i < items.size(); i += 1) {
            PilotContract.SnapshotItem item = items.get(i);
            card.addView(snapshotItemContent(item));
            if (i < items.size() - 1) {
                card.addView(Ui.space(this, 9));
                card.addView(Ui.divider(this));
                card.addView(Ui.space(this, 9));
            }
        }
        return card;
    }

    private LinearLayout snapshotCard(PilotContract.SnapshotItem item) {
        LinearLayout card = Ui.card(this);
        card.addView(snapshotItemContent(item));
        return card;
    }

    private LinearLayout snapshotItemContent(PilotContract.SnapshotItem item) {
        LinearLayout content = Ui.vertical(this);
        content.addView(Ui.sectionTitle(this, item.title()));
        content.addView(Ui.space(this, 6));
        content.addView(Ui.body(this, item.detail()));
        content.addView(Ui.space(this, 5));
        content.addView(Ui.small(this, item.meta()));
        return content;
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
            getString(R.string.fpo_synthetic_active),
            false
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
            .setMessage(text("ఈ పరికరంలోని పైలట్ సెషన్ మరియు స్థానిక వివరాలు తొలగించబడతాయి.", "इस डिवाइस का पायलट सत्र और स्थानीय विवरण मिट जाएगा।", "இந்தச் சாதனத்தின் முன்னோட்ட அமர்வும் உள்ளூர் விவரங்களும் நீக்கப்படும்.", "The pilot session and local details on this device will be removed."))
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

    private void applyPilotSnapshot() {
        if (PilotContract.SNAPSHOT_VERSION.equals(store.getString(KEY_SNAPSHOT_VERSION, ""))) {
            return;
        }
        store.putString(KEY_PROFILE_NAME, PilotContract.SNAPSHOT_FARMER_NAME);
        store.putString(KEY_PROFILE_GENDER, PilotContract.SNAPSHOT_FARMER_GENDER);
        store.putString(KEY_SNAPSHOT_VERSION, PilotContract.SNAPSHOT_VERSION);
    }

    private void showInfo(String title, String message) {
        new AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setPositiveButton(text("సరే", "ठीक है", "சரி", "OK"), null)
            .show();
    }

    private void toast(int stringResource) {
        Toast.makeText(this, stringResource, Toast.LENGTH_LONG).show();
    }

    private String text(String telugu, String hindi, String tamil, String english) {
        return switch (languageCode) {
            case "hi" -> hindi;
            case "ta" -> tamil;
            case "en" -> english;
            default -> telugu;
        };
    }

    private String formatTime(String instant) {
        try {
            DateTimeFormatter formatter = DateTimeFormatter
                .ofPattern("dd-MM-yyyy HH:mm", Locale.forLanguageTag(languageCode + "-IN"))
                .withZone(ZoneId.systemDefault());
            return formatter.format(Instant.parse(instant));
        } catch (Exception ignored) {
            return instant;
        }
    }
}
