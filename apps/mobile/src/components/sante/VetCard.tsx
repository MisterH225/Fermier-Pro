import { useTranslation } from "react-i18next";
import type { VetSearchItemDto } from "../../lib/api";
import { buildVetCardModel } from "../../lib/directoryCardModel";
import { DirectoryProfileCard } from "../directory/DirectoryProfileCard";

type Props = {
  vet: VetSearchItemDto;
  onPress: () => void;
};

export function VetCard({ vet, onPress }: Props) {
  const { t } = useTranslation();
  const model = buildVetCardModel(vet, t);

  return (
    <DirectoryProfileCard
      name={model.name}
      title={model.title}
      photoUrl={model.photoUrl}
      available={model.available}
      availableLabel={t("collab.directory.online")}
      unavailableLabel={t("collab.directory.offline")}
      ratingLabel={model.ratingLabel}
      distanceLabel={model.distanceLabel}
      highlightLabel={model.highlightLabel}
      highlightIcon={model.highlightIcon}
      locationLabel={model.locationLabel}
      metaTiles={model.metaTiles}
      verified={model.verified}
      onPress={onPress}
    />
  );
}
