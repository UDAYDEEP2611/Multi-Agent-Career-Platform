"""Trains and compares every model for the chat, then exports the best ones.

    python3 ml/build_dataset.py && node ml/featurize.cjs && python3 ml/train.py

Each model is scored two ways:
  cv       5-fold cross-validation, split by sentence template (GroupKFold)
  holdout  the hand-written sentences in ml/data/holdout.json, never trained on

The models whose decisions can be written down as numbers run in the server
(services/nlp/trainedModels.js): linear ones and the neural network. Forests,
boosting and nearest neighbours are compared here too, but would need Python
running beside the server, so they are reported and not shipped.
"""
import json
import os
import warnings

import numpy as np
from scipy.special import softmax
from sklearn.ensemble import AdaBoostClassifier, ExtraTreesClassifier, GradientBoostingClassifier, RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.feature_selection import SelectKBest, chi2
from sklearn.linear_model import LogisticRegression, PassiveAggressiveClassifier, RidgeClassifier, SGDClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import GroupKFold
from sklearn.naive_bayes import BernoulliNB, ComplementNB, MultinomialNB
from sklearn.neighbors import KNeighborsClassifier, NearestCentroid
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import normalize
from sklearn.svm import LinearSVC
from sklearn.tree import DecisionTreeClassifier

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "services", "nlp", "models")
TOP_FEATURES = 3000

MODELS = {
    "Multinomial Naive Bayes": lambda: MultinomialNB(alpha=0.3),
    "Complement Naive Bayes": lambda: ComplementNB(alpha=0.3),
    "Bernoulli Naive Bayes": lambda: BernoulliNB(alpha=0.3),
    "Logistic regression": lambda: LogisticRegression(C=8, max_iter=2000, class_weight="balanced"),
    "Linear SVM": lambda: LinearSVC(C=0.7, class_weight="balanced"),
    "SGD classifier": lambda: SGDClassifier(loss="log_loss", alpha=1e-4, max_iter=2000, random_state=7),
    "Ridge classifier": lambda: RidgeClassifier(alpha=0.5, class_weight="balanced"),
    "Passive aggressive": lambda: PassiveAggressiveClassifier(C=0.5, max_iter=2000, random_state=7),
    "Nearest centroid": lambda: NearestCentroid(),
    "K nearest neighbours": lambda: KNeighborsClassifier(n_neighbors=5, metric="cosine"),
    "Decision tree": lambda: DecisionTreeClassifier(random_state=7),
    "Random forest": lambda: RandomForestClassifier(n_estimators=200, random_state=7, n_jobs=-1),
    "Extra trees": lambda: ExtraTreesClassifier(n_estimators=200, random_state=7, n_jobs=-1),
    "Gradient boosting": lambda: GradientBoostingClassifier(n_estimators=60, random_state=7),
    "AdaBoost": lambda: AdaBoostClassifier(n_estimators=100, random_state=7),
    "Neural network (MLP)": lambda: MLPClassifier(hidden_layer_sizes=(48,), alpha=1e-3, max_iter=250, early_stopping=False, random_state=7),
}
# What runs in the server
EXPORT = ["Complement Naive Bayes", "Logistic regression", "Linear SVM", "Neural network (MLP)"]
DENSE = {"Gradient boosting", "AdaBoost", "Bernoulli Naive Bayes"}


def vectorizer():
    return TfidfVectorizer(analyzer=lambda features: features, sublinear_tf=True, min_df=2, norm=None)


def fit_transform(rows, labels):
    vec = vectorizer()
    x = vec.fit_transform([row["features"] for row in rows])
    select = SelectKBest(chi2, k=min(TOP_FEATURES, x.shape[1])).fit(x, labels)
    return vec, select, normalize(select.transform(x))


def run(name, x_train, y_train, x_test):
    model = MODELS[name]()
    dense = name in DENSE
    model.fit(x_train.toarray() if dense else x_train, y_train)
    return model, model.predict(x_test.toarray() if dense else x_test)


def rounded(matrix, digits=3):
    return [[round(float(value), digits) for value in row] for row in matrix]


def linear(model, labels):
    """{ weights: [per label: {feature index: weight}], bias } for scores = w.x + b"""
    coef = np.asarray(model.coef_ if not isinstance(model, ComplementNB) else model.feature_log_prob_)
    bias = np.asarray(model.intercept_ if hasattr(model, "intercept_") else np.zeros(len(labels)))
    if coef.shape[0] == 1:  # two labels: one row
        coef, bias = np.vstack([-coef, coef]), np.array([-bias[0], bias[0]])
    return {"coef": rounded(coef), "bias": [round(float(value), 3) for value in bias]}


def probabilities(name, model, x):
    """The same arithmetic the server does, to check the export."""
    if name == "Neural network (MLP)":
        hidden = np.maximum(x @ model.coefs_[0] + model.intercepts_[0], 0)
        return softmax(hidden @ model.coefs_[1] + model.intercepts_[1], axis=1)
    if isinstance(model, ComplementNB):
        return softmax(x @ model.feature_log_prob_.T, axis=1)
    if isinstance(model, LinearSVC):
        return softmax(model.decision_function(x) * 2, axis=1)
    return softmax(model.decision_function(x), axis=1)


data = json.load(open(os.path.join(HERE, "data", "features.json")))
os.makedirs(OUT, exist_ok=True)
card = {"note": "Accuracy on ml/data/holdout.json, written by hand and never trained on. cv is 5-fold, split by sentence template.", "tasks": {}}

for task, sets in data.items():
    train, hold = sets["train"], sets["holdout"]
    y = np.array([row["label"] for row in train])
    groups = np.array([row["group"] for row in train])
    y_hold = np.array([row["label"] for row in hold])
    labels = sorted(set(y))
    vec, select, x = fit_transform(train, y)
    x_hold = normalize(select.transform(vec.transform([row["features"] for row in hold])))

    print(f"\n=== {task}: {len(train)} examples, {x.shape[1]} features, {len(hold)} hand-written tests")
    print(f"{'model':28} {'cv':>6} {'holdout':>8} {'macro F1':>9}")
    table = []
    for name in MODELS:
        cv = []
        for fit, test in GroupKFold(n_splits=5).split(x, y, groups):
            _, predicted = run(name, x[fit], y[fit], x[test])
            cv.append(accuracy_score(y[test], predicted))
        _, predicted = run(name, x, y, x_hold)
        score = accuracy_score(y_hold, predicted)
        f1 = f1_score(y_hold, predicted, average="macro", zero_division=0)
        table.append({"model": name, "cv": round(float(np.mean(cv)), 3), "holdout": round(float(score), 3), "macroF1": round(float(f1), 3), "shipped": name in EXPORT})
        print(f"{name:28} {np.mean(cv):6.3f} {score:8.3f} {f1:9.3f}{'  *' if name in EXPORT else ''}")

    # The shipped ensemble: each model weighted by its cross-validated accuracy
    # (not the holdout, which must stay a test)
    fitted = {name: run(name, x, y, x_hold)[0] for name in EXPORT}
    weights = {name: next(row["cv"] for row in table if row["model"] == name) ** 4 for name in EXPORT}
    total = sum(weights.values())
    votes = sum(weights[name] / total * probabilities(name, fitted[name], x_hold) for name in EXPORT)
    classes = fitted[EXPORT[0]].classes_
    ensemble = classes[votes.argmax(axis=1)]
    score = accuracy_score(y_hold, ensemble)
    print(f"{'SHIPPED ENSEMBLE':28} {'':6} {score:8.3f} {f1_score(y_hold, ensemble, average='macro', zero_division=0):9.3f}")
    wrong = [(row["text"], row["label"], guess) for row, guess in zip(hold, ensemble) if row["label"] != guess]
    for text, want, got in wrong:
        print(f"   wrong: {text[:70]!r} want {want}, got {got}")

    names = vec.get_feature_names_out()[select.get_support()]
    idf = vec.idf_[select.get_support()]
    mlp = fitted["Neural network (MLP)"]
    exported = {
        "task": task, "labels": list(classes), "features": list(names), "idf": [round(float(value), 3) for value in idf],
        "models": {
            "Complement Naive Bayes": {"kind": "nb", "weight": weights["Complement Naive Bayes"] / total, **linear(fitted["Complement Naive Bayes"], classes)},
            "Logistic regression": {"kind": "linear", "weight": weights["Logistic regression"] / total, **linear(fitted["Logistic regression"], classes)},
            "Linear SVM": {"kind": "svm", "weight": weights["Linear SVM"] / total, **linear(fitted["Linear SVM"], classes)},
            "Neural network (MLP)": {"kind": "mlp", "weight": weights["Neural network (MLP)"] / total, "hidden": rounded(mlp.coefs_[0]), "hiddenBias": [round(float(v), 3) for v in mlp.intercepts_[0]], "output": rounded(mlp.coefs_[1]), "outputBias": [round(float(v), 3) for v in mlp.intercepts_[1]]}
        }
    }
    # What the server must reproduce from the rounded weights (tests/nlp.test.js)
    exported["golden"] = [{"text": row["text"], "p": [round(float(value), 4) for value in vote]} for row, vote in list(zip(hold, votes))[:12]]
    path = os.path.join(OUT, f"{task}.json")
    json.dump(exported, open(path, "w"), separators=(",", ":"))
    print(f"exported {path.split('/')[-1]}: {os.path.getsize(path) // 1024} KB")
    card["tasks"][task] = {"examples": len(train), "holdoutTests": len(hold), "ensembleHoldout": round(float(score), 3), "models": table, "wrong": [{"text": t, "want": w, "got": g} for t, w, g in wrong]}

json.dump(card, open(os.path.join(OUT, "model-card.json"), "w"), indent=1)
