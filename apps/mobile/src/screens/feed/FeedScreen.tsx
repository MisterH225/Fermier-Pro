import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import { AppealModal } from "../../components/feed/AppealModal";
import { ModerationWarningBanner } from "../../components/feed/ModerationWarningBanner";
import { ProfileBadge } from "../../components/feed/ProfileBadge";
import { SuspensionBanner } from "../../components/feed/SuspensionBanner";
import { MobileAppShell } from "../../components/layout";
import { useSession } from "../../context/SessionContext";
import {
  createFeedComment,
  createFeedPost,
  fetchFeedPosts,
  fetchFeedPostTypes,
  fetchFeedRules,
  type CommunityFeedPostType,
  type FeedPostDto
} from "../../lib/api/community-feed";
import { checkFeedContentBeforeSend } from "../../services/ai/FeedModerationAgent";
import { appealFeedSanction, getMyFeedStatus } from "../../services/ai/SanctionService";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { useScreenTitle } from "../../hooks/useScreenTitle";
import type { RootStackParamList } from "../../types/navigation";

const POST_TYPE_LABELS: Record<CommunityFeedPostType, string> = {
  question: "Question",
  tip: "Astuce",
  observation: "Observation",
  alert: "Alerte",
  success: "Réussite",
  medical_tip: "Conseil vétérinaire",
  technical_tip: "Conseil technique"
};

function postTypeLabel(type: CommunityFeedPostType | string | null | undefined): string {
  if (type && type in POST_TYPE_LABELS) {
    return POST_TYPE_LABELS[type as CommunityFeedPostType];
  }
  return "Publication";
}

function PostCard({
  post,
  canComment,
  onComment
}: {
  post: FeedPostDto;
  canComment: boolean;
  onComment: (postId: string, body: string) => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const displayName = post.isAnonymous
    ? post.authorRegion ?? "Région"
    : post.authorDisplayName ?? "Membre";

  return (
    <View
      style={[
        styles.postCard,
        post.isVetHighlight && styles.vetHighlight
      ]}
    >
      <View style={styles.postHeader}>
        <Text style={styles.authorName}>{displayName}</Text>
        <ProfileBadge profileType={post.authorProfileType} anonymous={post.isAnonymous} />
      </View>
      <Text style={styles.postType}>{postTypeLabel(post.postType)}</Text>
      <Text style={styles.postBody}>{post.body}</Text>
      {post.medicalDisclaimer ? (
        <Text style={styles.disclaimer}>{post.medicalDisclaimer}</Text>
      ) : null}
      {post.postType === "alert" ? (
        <Text style={styles.conditionalHint}>
          Cette alerte est partagée à titre informatif — consultez un professionnel si besoin.
        </Text>
      ) : null}
      {(post.comments ?? []).map((c) => (
        <View key={c.id} style={styles.comment}>
          <View style={styles.postHeader}>
            <Text style={styles.commentAuthor}>
              {c.isAnonymous ? c.authorRegion ?? "Région" : c.authorDisplayName ?? "Membre"}
            </Text>
            <ProfileBadge profileType={c.authorProfileType} anonymous={c.isAnonymous} />
          </View>
          <Text style={styles.commentBody}>{c.body}</Text>
        </View>
      ))}
      {canComment ? (
        <View style={styles.commentRow}>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="Commenter…"
            placeholderTextColor={mobileColors.textSecondary}
          />
          <Pressable
            disabled={!comment.trim() || sending}
            onPress={() => {
              setSending(true);
              void onComment(post.id, comment.trim()).finally(() => {
                setComment("");
                setSending(false);
              });
            }}
            style={[styles.commentBtn, (!comment.trim() || sending) && styles.disabledBtn]}
          >
            <Text style={styles.commentBtnTx}>Envoyer</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function FeedScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const { accessToken, activeProfileId } = useSession();
  const [composerOpen, setComposerOpen] = useState(false);
  const [body, setBody] = useState("");
  const [postType, setPostType] = useState<CommunityFeedPostType>("question");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [modWarning, setModWarning] = useState<string | null>(null);
  const [modSeverity, setModSeverity] = useState<"low" | "medium" | "high" | null>(null);
  const [appealOpen, setAppealOpen] = useState(false);

  useScreenTitle(navigation, t("navigation.main.feed"));

  const enabled = Boolean(accessToken && activeProfileId);

  const statusQ = useQuery({
    queryKey: ["feedMyStatus", activeProfileId],
    queryFn: () => getMyFeedStatus(accessToken!, activeProfileId!),
    enabled,
    retry: false
  });

  const postsQ = useQuery({
    queryKey: ["feedPosts", activeProfileId],
    queryFn: () => fetchFeedPosts(accessToken!, activeProfileId!),
    enabled: enabled && (statusQ.data?.canRead ?? true),
    retry: false
  });

  const typesQ = useQuery({
    queryKey: ["feedPostTypes", activeProfileId],
    queryFn: () => fetchFeedPostTypes(accessToken!, activeProfileId!),
    enabled,
    retry: false
  });

  const rulesQ = useQuery({
    queryKey: ["feedRules", activeProfileId],
    queryFn: () => fetchFeedRules(accessToken!, activeProfileId!),
    enabled,
    retry: false
  });

  const createPostM = useMutation({
    mutationFn: (input: { postType: CommunityFeedPostType; body: string; isAnonymous: boolean }) =>
      createFeedPost(accessToken!, activeProfileId!, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["feedPosts"] });
      void queryClient.invalidateQueries({ queryKey: ["feedUnreadCount"] });
      setBody("");
      setComposerOpen(false);
      setModWarning(null);
    }
  });

  const onPreCheck = useCallback(
    async (text: string) => {
      if (!accessToken || !activeProfileId || text.trim().length < 3) {
        setModWarning(null);
        return;
      }
      try {
        const result = await checkFeedContentBeforeSend(accessToken, activeProfileId, text);
        setModWarning(result.warningMessageFr);
        setModSeverity(result.severity);
      } catch {
        setModWarning(null);
      }
    },
    [accessToken, activeProfileId]
  );

  const handleSendPost = async () => {
    if (!accessToken || !activeProfileId || !body.trim()) {
      return;
    }
    const check = await checkFeedContentBeforeSend(accessToken, activeProfileId, body);
    if (check.shouldBlock || !check.allowed) {
      setModWarning(check.warningMessageFr);
      setModSeverity(check.severity);
      return;
    }
    await createPostM.mutateAsync({
      postType,
      body: body.trim(),
      isAnonymous
    });
  };

  const handleComment = async (postId: string, commentBody: string) => {
    if (!accessToken || !activeProfileId) {
      return;
    }
    const check = await checkFeedContentBeforeSend(accessToken, activeProfileId, commentBody);
    if (check.shouldBlock || !check.allowed) {
      throw new Error(check.warningMessageFr ?? "Commentaire bloqué.");
    }
    await createFeedComment(accessToken, activeProfileId, { postId, body: commentBody });
    void queryClient.invalidateQueries({ queryKey: ["feedPosts"] });
  };

  const canPost = statusQ.data?.canPost ?? false;
  const canComment = statusQ.data?.canComment ?? false;
  const postTypes = Array.isArray(typesQ.data?.types) ? typesQ.data.types : [];

  const selectedType = useMemo(
    () => (postTypes.includes(postType) ? postType : postTypes[0] ?? "question"),
    [postTypes, postType]
  );

  const loadError =
    statusQ.isError || postsQ.isError
      ? t(
          "feed.loadError",
          "Impossible de charger le Feed pour le moment. Vérifiez votre connexion ou réessayez plus tard."
        )
      : null;

  return (
    <MobileAppShell hideTopBar omitBottomTabBar>
      <View style={styles.container}>
        {loadError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerTx}>{loadError}</Text>
          </View>
        ) : null}
        {statusQ.data ? (
          <SuspensionBanner
            feedStatus={statusQ.data.feedStatus}
            suspensionUntil={statusQ.data.feedSuspensionUntil}
            onAppeal={
              statusQ.data.feedStatus !== "active"
                ? () => setAppealOpen(true)
                : undefined
            }
          />
        ) : null}

        {rulesQ.data?.rules?.length ? (
          <Pressable style={styles.rulesLink}>
            <Text style={styles.rulesTx}>Charte communautaire ({rulesQ.data.rules.length} règles)</Text>
          </Pressable>
        ) : null}

        {composerOpen && canPost ? (
          <View style={styles.composer}>
            <View style={styles.typeRow}>
              {postTypes.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setPostType(type)}
                  style={[styles.typeChip, selectedType === type && styles.typeChipActive]}
                >
                  <Text style={styles.typeChipTx}>{postTypeLabel(type)}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.composerInput}
              multiline
              value={body}
              onChangeText={(t) => {
                setBody(t);
                void onPreCheck(t);
              }}
              placeholder={
                selectedType === "medical_tip"
                  ? "Partagez un conseil médical avec la communauté…"
                  : selectedType === "technical_tip"
                    ? "Partagez une astuce technique ou d'équipement…"
                    : "Partagez avec la communauté…"
              }
              placeholderTextColor={mobileColors.textSecondary}
            />
            {selectedType === "medical_tip" ? (
              <Text style={styles.disclaimer}>
                Ce conseil est partagé à titre informatif — consultez un vétérinaire pour un diagnostic.
              </Text>
            ) : null}
            {modWarning ? (
              <ModerationWarningBanner message={modWarning} severity={modSeverity} />
            ) : null}
            <Pressable onPress={() => setIsAnonymous((v) => !v)} style={styles.anonToggle}>
              <Text style={styles.anonTx}>
                {isAnonymous ? "☑ Anonyme (région uniquement)" : "☐ Publier avec mon nom"}
              </Text>
            </Pressable>
            <View style={styles.composerActions}>
              <Pressable onPress={() => setComposerOpen(false)}>
                <Text style={styles.cancelTx}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleSendPost()}
                style={[styles.postBtn, createPostM.isPending && styles.disabledBtn]}
                disabled={createPostM.isPending || !body.trim()}
              >
                {createPostM.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.postBtnTx}>Publier</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : canPost ? (
          <Pressable style={styles.newPostBtn} onPress={() => setComposerOpen(true)}>
            <Text style={styles.newPostTx}>+ Nouvelle publication</Text>
          </Pressable>
        ) : statusQ.data && !canPost ? (
          <Text style={styles.disabledHint}>
            Publication désactivée — accès suspendu
            {statusQ.data.feedSuspensionUntil
              ? ` jusqu'au ${new Date(statusQ.data.feedSuspensionUntil).toLocaleDateString("fr-FR")}`
              : ""}
          </Text>
        ) : null}

        {postsQ.isPending ? (
          <ActivityIndicator style={styles.loader} />
        ) : (
          <FlatList
            style={styles.listFlex}
            data={Array.isArray(postsQ.data?.items) ? postsQ.data.items : []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <PostCard post={item} canComment={canComment} onComment={handleComment} />
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>Aucune publication pour le moment. Soyez le premier !</Text>
            }
          />
        )}
      </View>

      <AppealModal
        visible={appealOpen}
        onClose={() => setAppealOpen(false)}
        onSubmit={async (message) => {
          await appealFeedSanction(accessToken!, activeProfileId!, message);
          void statusQ.refetch();
        }}
      />
    </MobileAppShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: mobileSpacing.md },
  listFlex: { flex: 1 },
  list: { paddingBottom: 120, gap: mobileSpacing.md },
  loader: { marginTop: 24 },
  errorBanner: {
    backgroundColor: "#FEE2E2",
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.sm,
    marginBottom: mobileSpacing.sm
  },
  errorBannerTx: {
    ...mobileTypography.meta,
    color: mobileColors.error,
    textAlign: "center"
  },
  postCard: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  vetHighlight: { borderColor: "#4A90D9", borderWidth: 1 },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.xs,
    flexWrap: "wrap"
  },
  authorName: { ...mobileTypography.cardTitle, fontSize: 15 },
  postType: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4
  },
  postBody: { ...mobileTypography.body, marginTop: mobileSpacing.xs },
  disclaimer: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontStyle: "italic",
    marginTop: mobileSpacing.sm
  },
  conditionalHint: {
    ...mobileTypography.meta,
    color: "#92400E",
    marginTop: mobileSpacing.xs
  },
  comment: {
    marginTop: mobileSpacing.sm,
    paddingTop: mobileSpacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border
  },
  commentAuthor: { ...mobileTypography.meta, fontWeight: "600" },
  commentBody: { ...mobileTypography.body, fontSize: 14, marginTop: 2 },
  commentRow: { flexDirection: "row", gap: mobileSpacing.xs, marginTop: mobileSpacing.sm },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.sm,
    paddingVertical: 8,
    ...mobileTypography.body
  },
  commentBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    justifyContent: "center"
  },
  commentBtnTx: { color: "#fff", fontWeight: "600", fontSize: 13 },
  composer: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.md,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: mobileSpacing.sm },
  typeChip: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  typeChipActive: { backgroundColor: mobileColors.accent, borderColor: mobileColors.accent },
  typeChipTx: { ...mobileTypography.meta, fontSize: 11 },
  composerInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.sm,
    textAlignVertical: "top",
    ...mobileTypography.body
  },
  anonToggle: { marginTop: mobileSpacing.sm },
  anonTx: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  composerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: mobileSpacing.md,
    marginTop: mobileSpacing.sm,
    alignItems: "center"
  },
  cancelTx: { ...mobileTypography.body, color: mobileColors.textSecondary },
  postBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    minWidth: 100,
    alignItems: "center"
  },
  postBtnTx: { color: "#fff", fontWeight: "600" },
  disabledBtn: { opacity: 0.5 },
  newPostBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    alignItems: "center",
    marginBottom: mobileSpacing.md
  },
  newPostTx: { color: "#fff", fontWeight: "700" },
  disabledHint: {
    ...mobileTypography.meta,
    color: mobileColors.error,
    marginBottom: mobileSpacing.md,
    textAlign: "center"
  },
  rulesLink: { marginBottom: mobileSpacing.sm },
  rulesTx: {
    ...mobileTypography.meta,
    color: mobileColors.accent,
    textDecorationLine: "underline"
  },
  empty: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    marginTop: 40
  }
});
