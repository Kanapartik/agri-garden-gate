package com.agrighar.farmer;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Space;
import android.widget.TextView;

final class Ui {
    static final int GREEN_900 = Color.rgb(23, 63, 42);
    static final int GREEN_700 = Color.rgb(39, 103, 73);
    static final int GREEN_500 = Color.rgb(63, 143, 98);
    static final int GREEN_100 = Color.rgb(221, 242, 228);
    static final int CREAM = Color.rgb(247, 245, 238);
    static final int GOLD = Color.rgb(229, 169, 61);
    static final int TEXT = Color.rgb(24, 48, 42);
    static final int MUTED = Color.rgb(97, 115, 107);
    static final int WHITE = Color.WHITE;
    static final int BORDER = Color.rgb(220, 226, 218);
    static final int WARNING_BG = Color.rgb(253, 241, 219);
    static final int WARNING = Color.rgb(154, 91, 19);

    private Ui() {
    }

    static int dp(Context context, int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }

    static Page page(Context context) {
        ScrollView scroll = new ScrollView(context);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(CREAM);
        scroll.setClipToPadding(false);
        scroll.setOnApplyWindowInsetsListener((view, insets) -> {
            android.graphics.Insets systemBars = insets.getInsets(WindowInsets.Type.systemBars());
            view.setPadding(0, systemBars.top, 0, systemBars.bottom);
            return insets;
        });

        LinearLayout content = vertical(context);
        content.setPadding(dp(context, 22), dp(context, 20), dp(context, 22), dp(context, 32));
        scroll.addView(content, new ScrollView.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        return new Page(scroll, content);
    }

    static LinearLayout vertical(Context context) {
        LinearLayout layout = new LinearLayout(context);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        return layout;
    }

    static LinearLayout horizontal(Context context) {
        LinearLayout layout = new LinearLayout(context);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setGravity(Gravity.CENTER_VERTICAL);
        layout.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        return layout;
    }

    static TextView brand(Context context) {
        TextView view = text(context, 30, GREEN_900, Typeface.BOLD);
        view.setText(context.getString(R.string.brand_name));
        view.setLetterSpacing(0.01f);
        return view;
    }

    static TextView title(Context context, CharSequence text) {
        TextView view = text(context, 26, TEXT, Typeface.BOLD);
        view.setText(text);
        view.setLineSpacing(0f, 1.12f);
        return view;
    }

    static TextView sectionTitle(Context context, CharSequence text) {
        TextView view = text(context, 18, TEXT, Typeface.BOLD);
        view.setText(text);
        return view;
    }

    static TextView body(Context context, CharSequence text) {
        TextView view = text(context, 15, MUTED, Typeface.NORMAL);
        view.setText(text);
        view.setLineSpacing(dp(context, 3), 1f);
        return view;
    }

    static TextView small(Context context, CharSequence text) {
        TextView view = text(context, 12, MUTED, Typeface.NORMAL);
        view.setText(text);
        view.setLineSpacing(dp(context, 2), 1f);
        return view;
    }

    static TextView label(Context context, CharSequence text) {
        TextView view = text(context, 13, TEXT, Typeface.BOLD);
        view.setText(text);
        return view;
    }

    static TextView metric(Context context, CharSequence text) {
        TextView view = text(context, 32, GREEN_900, Typeface.BOLD);
        view.setText(text);
        return view;
    }

    static TextView pill(Context context, CharSequence text, boolean warning) {
        TextView view = text(context, 12, warning ? WARNING : GREEN_700, Typeface.BOLD);
        view.setText(text);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(context, 12), dp(context, 7), dp(context, 12), dp(context, 7));
        view.setBackground(rounded(
            warning ? WARNING_BG : GREEN_100,
            warning ? WARNING_BG : GREEN_100,
            dp(context, 20),
            0
        ));
        view.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        return view;
    }

    static EditText input(Context context, CharSequence hint, int inputType) {
        EditText input = new EditText(context);
        input.setHint(hint);
        input.setTextColor(TEXT);
        input.setHintTextColor(Color.rgb(132, 146, 139));
        input.setTextSize(16);
        input.setSingleLine(true);
        input.setInputType(inputType);
        input.setPadding(dp(context, 16), dp(context, 14), dp(context, 16), dp(context, 14));
        input.setBackground(rounded(WHITE, BORDER, dp(context, 14), dp(context, 1)));
        input.setLayoutParams(matchWrap(context));
        return input;
    }

    static EditText phoneInput(Context context) {
        return input(
            context,
            context.getString(R.string.phone_hint),
            InputType.TYPE_CLASS_PHONE
        );
    }

    static Button primaryButton(Context context, CharSequence text) {
        Button button = new Button(context);
        button.setText(text);
        button.setTextColor(WHITE);
        button.setTextSize(15);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setAllCaps(false);
        button.setMinHeight(dp(context, 54));
        button.setPadding(dp(context, 18), dp(context, 10), dp(context, 18), dp(context, 10));
        button.setBackgroundTintList(new ColorStateList(
            new int[][] { new int[] { -android.R.attr.state_enabled }, new int[] {} },
            new int[] { Color.rgb(170, 189, 179), GREEN_700 }
        ));
        button.setLayoutParams(matchWrap(context));
        return button;
    }

    static Button secondaryButton(Context context, CharSequence text) {
        Button button = new Button(context);
        button.setText(text);
        button.setTextColor(GREEN_700);
        button.setTextSize(15);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setAllCaps(false);
        button.setMinHeight(dp(context, 50));
        button.setPadding(dp(context, 16), dp(context, 8), dp(context, 16), dp(context, 8));
        button.setBackgroundTintList(ColorStateList.valueOf(GREEN_100));
        button.setLayoutParams(matchWrap(context));
        return button;
    }

    static Button textButton(Context context, CharSequence text) {
        Button button = new Button(context);
        button.setText(text);
        button.setTextColor(GREEN_700);
        button.setTextSize(14);
        button.setAllCaps(false);
        button.setBackgroundColor(Color.TRANSPARENT);
        button.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        button.setPadding(0, 0, 0, 0);
        button.setMinHeight(dp(context, 44));
        button.setLayoutParams(matchWrap(context));
        return button;
    }

    static LinearLayout card(Context context) {
        LinearLayout card = vertical(context);
        card.setPadding(dp(context, 18), dp(context, 18), dp(context, 18), dp(context, 18));
        card.setBackground(rounded(WHITE, BORDER, dp(context, 20), dp(context, 1)));
        card.setElevation(dp(context, 2));
        return card;
    }

    static View divider(Context context) {
        View divider = new View(context);
        divider.setBackgroundColor(BORDER);
        divider.setLayoutParams(new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(context, 1)
        ));
        return divider;
    }

    static Space space(Context context, int heightDp) {
        Space space = new Space(context);
        space.setLayoutParams(new LinearLayout.LayoutParams(1, dp(context, heightDp)));
        return space;
    }

    static LinearLayout.LayoutParams matchWrap(Context context) {
        return new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
    }

    static LinearLayout.LayoutParams weighted(int weight) {
        return new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, weight);
    }

    static GradientDrawable rounded(int fill, int stroke, int radius, int strokeWidth) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(radius);
        if (strokeWidth > 0) {
            drawable.setStroke(strokeWidth, stroke);
        }
        return drawable;
    }

    private static TextView text(Context context, int sizeSp, int color, int style) {
        TextView view = new TextView(context);
        view.setTextSize(sizeSp);
        view.setTextColor(color);
        view.setTypeface(Typeface.create("sans", style));
        view.setLayoutParams(matchWrap(context));
        return view;
    }

    record Page(ScrollView root, LinearLayout content) {
    }
}
