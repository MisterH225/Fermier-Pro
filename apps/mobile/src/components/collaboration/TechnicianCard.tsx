import { useTranslation } from "react-i18next";
import type { TechnicianProfileDto } from "../../lib/api";
import { buildTechnicianCardModel } from "../../lib/directoryCardModel";
import { DirectoryProfileCard } from "../directory/DirectoryProfileCard";

type Props = {
  tech: TechnicianProfileDto;
  onPress: () => void;
};

export function TechnicianCard({ tech, onPress }: Props) {
  const { t } = useTranslation();
  const model = buildTechnicianCardModel(tech, t);

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
      onPress={onPress}
    />
  );
}
